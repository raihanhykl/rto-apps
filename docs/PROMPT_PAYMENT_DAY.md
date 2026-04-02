# PROMPT: Implementasi PaymentDay — Static Per-Date Records untuk WEDISON RTO

---

## META

- **Tujuan**: Menambahkan model `PaymentDay` yang menyimpan status eksplisit per-tanggal per-kontrak, menggantikan kalkulasi kalender dinamis.
- **Prasyarat**: Baca `CLAUDE.md` sebelum mulai. Semua aturan arsitektur, konvensi, dan bisnis logik di sana WAJIB diikuti.
- **Scope**: Backend (domain, application, infrastructure, presentation) + Frontend (calendar, types) + Tests.
- **Bahasa komunikasi**: Bahasa Indonesia untuk semua output teks ke user.

---

## KONTEKS MASALAH

Sistem kalender pembayaran saat ini menghitung status setiap tanggal secara **dinamis** di `PaymentService.getCalendarData()` (line 613-703). Logika: semua tanggal dari `billingStartDate` sampai `contract.endDate` dianggap "paid" secara berurutan, holiday dihitung algoritmik via `isLiburBayar()`, dan overdue/pending ditentukan dari active payment.

**Kelemahan yang harus dipecahkan:**

1. Tidak bisa merepresentasikan gap — jika tanggal 1 belum bayar tapi tanggal 2-3 sudah, sistem tidak bisa menampilkan ini karena "paid" = range kontinu.
2. Holiday dihitung ulang setiap request — perubahan `holidayScheme` retroaktif mengubah tampilan kalender historis.
3. Revert payment rapuh — harus recalculate `endDate` manual, rawan desync.
4. Tidak ada jejak per-tanggal — tidak bisa trace "tanggal X dibayar di payment mana?".
5. Admin tidak bisa koreksi status tanggal tertentu (misal: ubah tanggal lalu jadi holiday atau unpaid).

---

## KEPUTUSAN DESAIN

### Keputusan 1: Gap Billing — Akumulasi Semua Hari UNPAID (Opsi B)

**Konteks**: Dengan sistem PaymentDay, dimungkinkan adanya "gap" — tanggal yang sudah PAID lalu ada tanggal UNPAID di tengah (misal karena admin correction atau revert). Saat scheduler generate billing, harus diputuskan: apakah tagihan hanya cover hari ini, atau juga akumulasi semua hari UNPAID sebelumnya?

**Keputusan**: Gunakan **Opsi B — Akumulasi semua UNPAID past dates + hari ini** ke dalam satu invoice.

**Alasan**: Sejalan dengan mekanisme rollover existing. Jika ada gap (misal tanggal 7 = UNPAID, tanggal 8 = HOLIDAY, tanggal 9 = PAID, tanggal 10 = hari ini), maka tagihan baru akan mengcover tanggal 7 + 10 (semua UNPAID where date ≤ today).

**Flow detail:**

1. Scheduler jam 00:01 → `generateDailyPayments()`
2. Untuk setiap kontrak ACTIVE/OVERDUE:
   a. Buat PaymentDay record hari ini (jika belum ada)
   b. Query semua PaymentDay dengan `status = UNPAID` dan `date <= today`
   c. Jika ada → buat satu invoice yang mencakup semua tanggal UNPAID tersebut
   d. Update semua PaymentDay tersebut → `status = PENDING`, `paymentId = invoice.id`
3. `daysCount` = jumlah hari UNPAID yang di-cover
4. `amount` = sum dari `paymentDay.amount` semua hari yang di-cover
5. `periodStart` = tanggal UNPAID paling awal, `periodEnd` = tanggal UNPAID paling akhir

**Contoh skenario gap:**

```
6 Mar = PAID     (sudah dibayar)
7 Mar = UNPAID   (revert/koreksi admin)
8 Mar = HOLIDAY  (tetap holiday, skip)
9 Mar = PAID     (sudah dibayar)
10 Mar = hari ini, PaymentDay baru dibuat → UNPAID
```

Tagihan baru: cover tanggal 7 + 10 (2 hari kerja), amount = 2 × dailyRate.
Tanggal 6 dan 9 tidak terpengaruh (sudah PAID). Tanggal 8 tidak terpengaruh (HOLIDAY).

### Keputusan 2: Partial Payment — Pengurangan Tagihan Aktif

**Konteks**: Customer keberatan membayar tagihan akumulasi yang besar. Management setuju untuk menerima pembayaran parsial (sebagian hari saja), atas persetujuan admin.

**Keputusan**: Admin bisa mengurangi jumlah hari pada tagihan aktif. Sisa hari kembali ke `UNPAID` dan akan di-pickup oleh rollover berikutnya.

**Flow detail:**

**Situasi awal:**

```
Tanggal 8:  PENDING → linked ke PMT-001 (4 hari × Rp58.000 = Rp232.000)
Tanggal 9:  PENDING → linked ke PMT-001
Tanggal 10: PENDING → linked ke PMT-001
Tanggal 11: PENDING → linked ke PMT-001 ← hari ini
```

**Admin action: "Kurangi tagihan jadi 2 hari" (tanggal 8-9 saja):**

Step 1 — Void invoice lama:

- PMT-001 → status `VOID`
- PaymentDay tanggal 8-11: `invoiceId = null`, `status = UNPAID`

Step 2 — Buat invoice baru untuk 2 hari:

- PMT-002: 2 hari (tanggal 8-9), amount = Rp116.000, status `PENDING`
- PaymentDay tanggal 8-9: `invoiceId = PMT-002`, `status = PENDING`
- PaymentDay tanggal 10-11: tetap `UNPAID` (belum di-bill)

**Customer bayar PMT-002:**

- PMT-002 → `PAID`
- PaymentDay tanggal 8-9 → `PAID`
- Contract: `workingDaysPaid += 2`, `totalDaysPaid += 2`

**Keesokan hari (tanggal 12) — Rollover otomatis:**

- Scheduler cek semua UNPAID ≤ today → tanggal 10, 11, 12
- Buat PMT-003: 3 hari × Rp58.000 = Rp174.000
- PaymentDay tanggal 10-12 → `PENDING`, linked ke PMT-003

**Implementasi**: Reuse pattern `void + createManualPayment` yang sudah ada. TIDAK perlu fitur "split" terpisah — cukup void invoice lama, buat invoice baru dengan jumlah hari lebih sedikit. Sisa hari UNPAID otomatis di-pickup rollover.

**API**: `POST /api/payments/:id/reduce` dengan body `{ newDaysCount: number }`, ATAU admin bisa manual via void + create manual payment yang sudah ada.

---

## ARSITEKTUR & KONVENSI PROJECT (WAJIB DIIKUTI)

### Clean Architecture Layers

```
Domain (entities, enums, interfaces) — TIDAK boleh import layer lain
  ↑
Application (services, DTOs) — hanya import Domain
  ↑
Infrastructure (repositories, scheduler, middleware) — import Domain + Application
  ↑
Presentation (controllers, routes) — hanya panggil Application services
```

### Konvensi Kode

- **Entity**: TypeScript interface di `src/domain/entities/`, export via barrel `index.ts`
- **Enum**: di `src/domain/enums/index.ts`, format `ENUM_NAME = 'ENUM_NAME'`
- **Repository interface**: di `src/domain/interfaces/`, export via barrel `index.ts`
- **Repository impl**: InMemory (`Map<string, T>`) + Prisma, di `src/infrastructure/repositories/`, export via barrel `index.ts`
- **Prisma model**: snake_case columns via `@map`, camelCase fields di TypeScript
- **ID**: UUID v4 via `uuidv4()` dari `uuid` package
- **Date "hari ini"**: WAJIB `getWibToday()` dari `src/domain/utils/dateUtils.ts`, BUKAN `new Date()`
- **Audit log**: setiap mutasi data WAJIB dicatat
- **Test**: InMemory repositories, Jest + ts-jest

### File-File Kunci yang Akan Dimodifikasi

| File                                                                               | Perubahan                             |
| ---------------------------------------------------------------------------------- | ------------------------------------- |
| `packages/backend/prisma/schema.prisma`                                            | Tambah enum + model + relasi          |
| `packages/backend/src/domain/enums/index.ts`                                       | Tambah `PaymentDayStatus` enum        |
| `packages/backend/src/domain/entities/PaymentDay.ts`                               | **BARU** — entity interface           |
| `packages/backend/src/domain/entities/index.ts`                                    | Tambah export                         |
| `packages/backend/src/domain/interfaces/IPaymentDayRepository.ts`                  | **BARU** — repo interface             |
| `packages/backend/src/domain/interfaces/index.ts`                                  | Tambah export                         |
| `packages/backend/src/infrastructure/repositories/InMemoryPaymentDayRepository.ts` | **BARU**                              |
| `packages/backend/src/infrastructure/repositories/PrismaPaymentDayRepository.ts`   | **BARU**                              |
| `packages/backend/src/infrastructure/repositories/index.ts`                        | Tambah export                         |
| `packages/backend/src/index.ts`                                                    | Wire repo baru, inject ke services    |
| `packages/backend/src/application/services/PaymentService.ts`                      | Update 10+ methods                    |
| `packages/backend/src/application/services/ContractService.ts`                     | Update receiveUnit, cancel, repossess |
| `packages/backend/src/infrastructure/scheduler.ts`                                 | Tambah extend records step            |
| `packages/backend/src/presentation/controllers/PaymentController.ts`               | Tambah admin correction endpoint      |
| `packages/backend/src/presentation/routes/index.ts`                                | Tambah route                          |
| `packages/backend/src/__tests__/PaymentService.test.ts`                            | Update setup + tambah test cases      |
| `packages/frontend/src/components/PaymentCalendar.tsx`                             | Tambah status `voided`                |
| `packages/frontend/src/types/index.ts`                                             | Tambah `PaymentDayStatus` enum        |
| `packages/frontend/src/lib/api.ts`                                                 | Tambah method admin correction        |

---

## LANGKAH 1: DATABASE SCHEMA

### 1A. Tambah Enum di Prisma Schema

**File**: `packages/backend/prisma/schema.prisma`
**Lokasi**: setelah enum `HolidayScheme` (sekitar line 69)

```prisma
enum PaymentDayStatus {
  UNPAID
  PENDING
  PAID
  HOLIDAY
  VOIDED
}
```

**Alasan setiap status:**

- `UNPAID` — Default saat record dibuat. Hari kerja belum ter-cover pembayaran. Di frontend: `date < today` → merah (overdue), `date >= today` → abu-abu (belum terbit).
- `PENDING` — Ada tagihan aktif (PMT-xxx, status PENDING) yang mencakup hari ini. Kuning di frontend.
- `PAID` — Sudah dibayar & dikonfirmasi. Hijau di frontend.
- `HOLIDAY` — Libur Bayar. Di-set saat record pertama kali dibuat berdasarkan `isLiburBayar()`. Immutable setelah dibuat (tidak berubah jika setting berubah). Biru di frontend.
- `VOIDED` — Dibatalkan (kontrak cancel/repossess, atau koreksi admin). Abu-abu gelap di frontend. Terminal — tidak akan berubah lagi.

> PENTING: Jangan reuse `PaymentStatus` yang sudah ada. `PaymentStatus` (PENDING/PAID/FAILED/EXPIRED/VOID) adalah status **transaksi/invoice**, sedangkan `PaymentDayStatus` adalah status **1 hari kerja** dalam kontrak. Konteks berbeda.

### 1B. Tambah Model PaymentDay

**File**: `packages/backend/prisma/schema.prisma`
**Lokasi**: setelah model `Setting` (akhir file)

```prisma
model PaymentDay {
  id         String           @id @default(uuid())
  contractId String           @map("contract_id")
  date       DateTime         // 1 record = 1 hari, time selalu 00:00:00
  status     PaymentDayStatus @default(UNPAID)
  paymentId  String?          @map("payment_id")  // FK ke Invoice yang cover hari ini
  dailyRate  Float            @map("daily_rate")   // snapshot tarif saat record dibuat (immutable)
  amount     Float            @default(0)          // actual amount (0 untuk HOLIDAY)
  notes      String?                               // catatan koreksi admin (opsional)
  createdAt  DateTime         @default(now()) @map("created_at")
  updatedAt  DateTime         @updatedAt @map("updated_at")

  contract Contract @relation(fields: [contractId], references: [id])
  payment  Invoice? @relation(fields: [paymentId], references: [id])

  @@unique([contractId, date])           // 1 kontrak = max 1 record per tanggal
  @@index([contractId, status])          // query: semua PAID days untuk kontrak X
  @@index([paymentId])                   // query: semua days yang di-cover payment Y
  @@index([contractId, date])            // query: calendar by month (redundan tapi explicit)
  @@map("payment_days")
}
```

**Penjelasan field-by-field:**

- `id`: UUID primary key, konsisten dengan semua model lain di project.
- `contractId`: FK ke Contract. Setiap PaymentDay milik tepat 1 kontrak.
- `date`: Tanggal spesifik. `@@unique([contractId, date])` menjamin tidak ada duplikat. Selalu midnight (00:00:00).
- `status`: Enum `PaymentDayStatus`. Default UNPAID.
- `paymentId`: Nullable FK ke Invoice (PMT-xxx). Null jika UNPAID atau HOLIDAY tanpa payment record. Terisi saat PENDING (linked ke tagihan aktif) atau PAID (linked ke tagihan yang membayar).
- `dailyRate`: Snapshot tarif harian saat record dibuat. Immutable. Berguna jika tarif kontrak berubah di masa depan — record lama tetap pakai tarif lama.
- `amount`: Jumlah yang ditagihkan untuk hari ini. `0` untuk HOLIDAY, `dailyRate` untuk hari kerja biasa. Dipisah dari `dailyRate` karena bisa ada adjustment.
- `notes`: Opsional. Diisi saat admin melakukan koreksi manual.

### 1C. Update Relasi di Model Existing

**Di model `Contract`** (sekitar line 170), sebelum `@@index`, tambah:

```prisma
  paymentDays PaymentDay[]
```

**Di model `Invoice`** (sekitar line 211), sebelum `@@index`, tambah:

```prisma
  paymentDays PaymentDay[]
```

### 1D. Generate Prisma Client

```bash
cd packages/backend && npx prisma generate
```

> JANGAN `db push` — itu dilakukan saat deploy atau manual. Cukup `generate` untuk update Prisma Client TypeScript types.

---

## LANGKAH 2: DOMAIN LAYER

### 2A. Tambah Enum

**File**: `packages/backend/src/domain/enums/index.ts`
**Lokasi**: setelah `HolidayScheme` enum (sekitar line 85)

```typescript
export enum PaymentDayStatus {
  UNPAID = 'UNPAID',
  PENDING = 'PENDING',
  PAID = 'PAID',
  HOLIDAY = 'HOLIDAY',
  VOIDED = 'VOIDED',
}
```

### 2B. Buat Entity

**File BARU**: `packages/backend/src/domain/entities/PaymentDay.ts`

```typescript
import { PaymentDayStatus } from '../enums';

export interface PaymentDay {
  id: string;
  contractId: string;
  date: Date;
  status: PaymentDayStatus;
  paymentId: string | null;
  dailyRate: number;
  amount: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2C. Update Barrel Export

**File**: `packages/backend/src/domain/entities/index.ts`

Tambah di akhir file:

```typescript
export type { PaymentDay } from './PaymentDay';
```

### 2D. Buat Repository Interface

**File BARU**: `packages/backend/src/domain/interfaces/IPaymentDayRepository.ts`

```typescript
import { PaymentDay } from '../entities/PaymentDay';
import { PaymentDayStatus } from '../enums';

export interface IPaymentDayRepository {
  findById(id: string): Promise<PaymentDay | null>;
  findByContractId(contractId: string): Promise<PaymentDay[]>;
  findByContractAndDateRange(
    contractId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentDay[]>;
  findByPaymentId(paymentId: string): Promise<PaymentDay[]>;
  findByContractAndDate(contractId: string, date: Date): Promise<PaymentDay | null>;
  findByContractAndStatus(contractId: string, status: PaymentDayStatus): Promise<PaymentDay[]>;

  create(paymentDay: PaymentDay): Promise<PaymentDay>;
  createMany(paymentDays: PaymentDay[]): Promise<number>;
  update(id: string, data: Partial<PaymentDay>): Promise<PaymentDay | null>;
  updateByContractAndDate(
    contractId: string,
    date: Date,
    data: Partial<PaymentDay>,
  ): Promise<PaymentDay | null>;
  updateManyByPaymentId(paymentId: string, data: Partial<PaymentDay>): Promise<number>;

  countByContractAndStatus(contractId: string, status: PaymentDayStatus): Promise<number>;
  countByContractAndStatuses(contractId: string, statuses: PaymentDayStatus[]): Promise<number>;
  findLastPaidOrHolidayDate(contractId: string): Promise<Date | null>;
}
```

### 2E. Update Barrel Export

**File**: `packages/backend/src/domain/interfaces/index.ts`

Tambah di akhir file:

```typescript
export type { IPaymentDayRepository } from './IPaymentDayRepository';
```

---

## LANGKAH 3: INFRASTRUCTURE LAYER — REPOSITORIES

### 3A. InMemoryPaymentDayRepository

**File BARU**: `packages/backend/src/infrastructure/repositories/InMemoryPaymentDayRepository.ts`

Implementasikan semua methods dari `IPaymentDayRepository` menggunakan `Map<string, PaymentDay>`.

**Pattern yang WAJIB diikuti** (referensi: `InMemoryInvoiceRepository.ts`):

- Private `private data = new Map<string, PaymentDay>();`
- Semua method async (return Promise)
- **Date comparison**: SELALU normalize ke midnight sebelum compare. Buat helper internal:
  ```typescript
  private toDateKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0]; // "YYYY-MM-DD"
  }
  ```
- `findByContractAndDateRange`: filter `date >= startDate && date <= endDate` (setelah normalize)
- `findByContractAndDate`: match exact date key
- `createMany`: loop dan insert ke Map, return count
- `updateManyByPaymentId`: find all records with matching paymentId, apply partial update, return count
- `countByContractAndStatuses`: count records matching contractId AND `statuses.includes(status)`
- `findLastPaidOrHolidayDate`: find MAX date where status is PAID or HOLIDAY. Return null jika tidak ada.

### 3B. PrismaPaymentDayRepository

**File BARU**: `packages/backend/src/infrastructure/repositories/PrismaPaymentDayRepository.ts`

**Pattern yang WAJIB diikuti** (referensi: `PrismaInvoiceRepository.ts`):

- Constructor menerima `PrismaClient`
- Private `toEntity(raw: any): PaymentDay` method — cast Prisma types ke domain PaymentDay, termasuk enum casting:
  ```typescript
  private toEntity(raw: any): PaymentDay {
    return {
      ...raw,
      status: raw.status as PaymentDayStatus,
    };
  }
  ```
- `findByContractAndDateRange`: `prisma.paymentDay.findMany({ where: { contractId, date: { gte: startDate, lte: endDate } }, orderBy: { date: 'asc' } })`
- `createMany`: `prisma.paymentDay.createMany({ data: [...], skipDuplicates: true })` — Prisma createMany hanya return count, bukan records. Gunakan `skipDuplicates: true` untuk idempotency.
- `updateManyByPaymentId`: `prisma.paymentDay.updateMany({ where: { paymentId }, data })` — return `count`
- `update`: exclude `id` dari update data (sama pattern dengan PrismaInvoiceRepository)
- `updateByContractAndDate`: gunakan `prisma.paymentDay.update({ where: { contractId_date: { contractId, date } }, data })` — menggunakan composite unique constraint
- `countByContractAndStatuses`: `where: { contractId, status: { in: statuses.map(s => s as any) } }` — cast enum untuk Prisma compatibility
- `findLastPaidOrHolidayDate`: `prisma.paymentDay.findFirst({ where: { contractId, status: { in: ['PAID', 'HOLIDAY'] } }, orderBy: { date: 'desc' } })` — return `result?.date ?? null`

### 3C. Update Barrel Export

**File**: `packages/backend/src/infrastructure/repositories/index.ts`

Tambah:

```typescript
export { InMemoryPaymentDayRepository } from './InMemoryPaymentDayRepository';
export { PrismaPaymentDayRepository } from './PrismaPaymentDayRepository';
```

---

## LANGKAH 4: WIRING — ENTRY POINT

**File**: `packages/backend/src/index.ts`

### 4A. Import

Tambah import di bagian atas (setelah existing imports dari repositories):

```typescript
import {
  InMemoryPaymentDayRepository,
  PrismaPaymentDayRepository,
} from './infrastructure/repositories';
import { IPaymentDayRepository } from './domain/interfaces/IPaymentDayRepository';
```

### 4B. Declare & Initialize Repository

Di bagian repository declaration (line 58-63), tambah:

```typescript
let paymentDayRepo: IPaymentDayRepository;
```

Di blok `if (usePrisma)` (line 65-75), tambah:

```typescript
paymentDayRepo = new PrismaPaymentDayRepository(prisma);
```

Di blok `else` InMemory (line 76-84), tambah:

```typescript
paymentDayRepo = new InMemoryPaymentDayRepository();
```

### 4C. Inject ke Services

Ubah inisialisasi PaymentService (line 91):

```typescript
// SEBELUM:
const paymentService = new PaymentService(invoiceRepo, contractRepo, auditRepo, settingService);

// SESUDAH:
const paymentService = new PaymentService(
  invoiceRepo,
  contractRepo,
  paymentDayRepo,
  auditRepo,
  settingService,
);
```

Ubah inisialisasi ContractService (line 90):

```typescript
// SEBELUM:
const contractService = new ContractService(
  contractRepo,
  customerRepo,
  invoiceRepo,
  auditRepo,
  settingService,
);

// SESUDAH:
const contractService = new ContractService(
  contractRepo,
  customerRepo,
  invoiceRepo,
  paymentDayRepo,
  auditRepo,
  settingService,
);
```

---

## LANGKAH 5: PAYMENTSERVICE — BUSINESS LOGIC CHANGES

**File**: `packages/backend/src/application/services/PaymentService.ts`

Ini bagian terbesar. Setiap instruksi di bawah WAJIB diikuti secara presisi.

### 5A. Constructor — Tambah Parameter

```typescript
// SEBELUM (line 31-36):
constructor(
  private invoiceRepo: IInvoiceRepository,
  private contractRepo: IContractRepository,
  private auditRepo: IAuditLogRepository,
  private settingService?: SettingService,
) {}

// SESUDAH:
constructor(
  private invoiceRepo: IInvoiceRepository,
  private contractRepo: IContractRepository,
  private paymentDayRepo: IPaymentDayRepository,
  private auditRepo: IAuditLogRepository,
  private settingService?: SettingService,
) {}
```

Import yang perlu ditambah di bagian atas file:

```typescript
import { IPaymentDayRepository } from '../../domain/interfaces';
import { PaymentDay } from '../../domain/entities';
import { PaymentDayStatus } from '../../domain/enums';
```

### 5B. Method Baru: `generatePaymentDaysForPeriod()`

Tambahkan setelah `isLiburBayar()` method. Method ini HARUS public karena akan dipanggil dari ContractService:

```typescript
/**
 * Generate PaymentDay records dari startDate sejumlah daysAhead calendar days ke depan.
 * Idempotent — skip tanggal yang sudah ada record-nya.
 * Holiday dates langsung set status=HOLIDAY, amount=0.
 * Working dates set status=UNPAID, amount=dailyRate.
 */
async generatePaymentDaysForPeriod(
  contract: Contract,
  startDate: Date,
  daysAhead: number
): Promise<void> {
  const records: PaymentDay[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const dateKey = new Date(current);
    dateKey.setHours(0, 0, 0, 0);

    const existing = await this.paymentDayRepo.findByContractAndDate(contract.id, dateKey);
    if (!existing) {
      const isHoliday = this.isLiburBayar(contract, dateKey);
      records.push({
        id: uuidv4(),
        contractId: contract.id,
        date: new Date(dateKey),
        status: isHoliday ? PaymentDayStatus.HOLIDAY : PaymentDayStatus.UNPAID,
        paymentId: null,
        dailyRate: contract.dailyRate,
        amount: isHoliday ? 0 : contract.dailyRate,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    current.setDate(current.getDate() + 1);
  }

  if (records.length > 0) {
    await this.paymentDayRepo.createMany(records);
  }
}
```

### 5C. Method Baru: `extendPaymentDayRecords()`

Dipanggil dari scheduler setiap hari:

```typescript
/**
 * Untuk setiap kontrak ACTIVE/OVERDUE, pastikan PaymentDay records
 * tersedia sampai 30 hari ke depan dari hari ini.
 */
async extendPaymentDayRecords(): Promise<void> {
  const today = getWibToday();
  const contracts = [
    ...(await this.contractRepo.findByStatus(ContractStatus.ACTIVE)),
    ...(await this.contractRepo.findByStatus(ContractStatus.OVERDUE)),
  ];

  for (const contract of contracts) {
    if (!contract.billingStartDate) continue;
    await this.generatePaymentDaysForPeriod(contract, today, 30);
  }
}
```

### 5D. Method Baru: `syncContractFromPaymentDays()`

Single source of truth untuk contract summary:

```typescript
/**
 * Recalculate contract summary fields (totalDaysPaid, workingDaysPaid,
 * holidayDaysPaid, ownershipProgress, endDate) dari PaymentDay records.
 */
private async syncContractFromPaymentDays(contractId: string): Promise<void> {
  const contract = await this.contractRepo.findById(contractId);
  if (!contract) return;

  const paidCount = await this.paymentDayRepo.countByContractAndStatus(contractId, PaymentDayStatus.PAID);
  const holidayCount = await this.paymentDayRepo.countByContractAndStatus(contractId, PaymentDayStatus.HOLIDAY);
  const totalPaid = paidCount + holidayCount;

  const lastDate = await this.paymentDayRepo.findLastPaidOrHolidayDate(contractId);

  const progress = contract.ownershipTargetDays > 0
    ? parseFloat(((totalPaid / contract.ownershipTargetDays) * 100).toFixed(2))
    : 0;

  const updates: Partial<Contract> = {
    totalDaysPaid: totalPaid,
    workingDaysPaid: paidCount,
    holidayDaysPaid: holidayCount,
    ownershipProgress: Math.min(progress, 100),
  };

  if (lastDate) {
    updates.endDate = lastDate;
  }

  if (totalPaid >= contract.ownershipTargetDays && contract.status !== ContractStatus.COMPLETED) {
    updates.status = ContractStatus.COMPLETED;
    updates.completedAt = new Date();
  }

  await this.contractRepo.update(contractId, updates);
}
```

### 5E. Update: `generateDailyPayments()` (line 71-162)

**PENTING — Opsi B (Akumulasi Gap):** Method ini HARUS mengikuti prinsip: kumpulkan SEMUA PaymentDay `UNPAID` yang `date <= today` menjadi satu invoice, bukan hanya hari ini. Ini menangani skenario gap (lihat KEPUTUSAN DESAIN #1).

**Flow baru per kontrak:**

1. Ensure PaymentDay record hari ini exist → `generatePaymentDaysForPeriod(contract, today, 1)`
2. Jika hari ini HOLIDAY → buat holiday payment (amount=0, auto-PAID), skip ke kontrak berikutnya
3. Query semua PaymentDay `status = UNPAID` dan `date <= today` untuk kontrak ini
4. Jika ada UNPAID days:
   a. Expire invoice PENDING lama (jika ada) → unlink PaymentDay-nya
   b. Hitung: `daysCount = unpaidDays.length`, `amount = sum(pd.amount)`, `periodStart = min(date)`, `periodEnd = max(date)`
   c. Buat satu invoice baru (PMT-xxx) dengan data tersebut
   d. Update semua PaymentDay UNPAID → `status = PENDING`, `paymentId = newInvoice.id`

**Contoh penanganan gap:**

```
// Tanggal 7 = UNPAID (revert/koreksi), 8 = HOLIDAY, 9 = PAID, 10 = hari ini (baru dibuat, UNPAID)
// Query UNPAID ≤ today → [7, 10]
// Invoice: cover tanggal 7 + 10, daysCount=2, amount=2×dailyRate
// periodStart=7, periodEnd=10
```

**Setelah holiday handling** (setelah `await this.createHolidayPayment(contract, now)`):

```typescript
// BARU: Ensure record exists dan link holiday payment
await this.generatePaymentDaysForPeriod(contract, now, 1);
await this.paymentDayRepo.updateByContractAndDate(contract.id, now, {
  paymentId: (await this.invoiceRepo.findActiveByContractId(contract.id))?.id ?? null,
});
// Note: holiday payment is auto-PAID, PaymentDay tetap HOLIDAY (sudah di-set saat generate)
```

> Catatan: createHolidayPayment() sudah memanggil creditDayToContract(). Setelah PaymentDay fully working, panggil `syncContractFromPaymentDays()` di sini sebagai pengganti.

**Setelah accumulated/daily payment created:**

```typescript
// BARU: Link semua UNPAID days ke payment baru
const unpaidDays = await this.paymentDayRepo.findByContractAndStatus(
  contract.id,
  PaymentDayStatus.UNPAID,
);
const todayDate = getWibToday();
for (const pd of unpaidDays) {
  const pdDate = new Date(pd.date);
  pdDate.setHours(0, 0, 0, 0);
  if (pdDate <= todayDate) {
    await this.paymentDayRepo.update(pd.id, {
      status: PaymentDayStatus.PENDING,
      paymentId: newPayment.id,
    });
  }
}
```

### 5F. Update: `rolloverPayment()` (line 269-358)

**PENTING — Opsi B**: Rollover juga HARUS mengikuti prinsip akumulasi gap. Saat expired payment di-unlink, semua UNPAID days (termasuk gap dari periode sebelumnya) harus masuk ke invoice baru.

Setelah expired payment di-mark EXPIRED (line 271-274):

```typescript
// BARU: Unlink semua PaymentDay dari expired payment → kembali ke UNPAID
await this.paymentDayRepo.updateManyByPaymentId(expiredPayment.id, {
  status: PaymentDayStatus.UNPAID,
  paymentId: null,
});
```

Setelah new payment created:

```typescript
// BARU: Pastikan PaymentDay hari ini sudah exist
await this.generatePaymentDaysForPeriod(contract, today, 1);

// Link SEMUA UNPAID days (termasuk gap) ke new payment — Opsi B
const allUnpaid = await this.paymentDayRepo.findByContractAndStatus(
  contract.id,
  PaymentDayStatus.UNPAID,
);
for (const pd of allUnpaid) {
  const pdDate = new Date(pd.date);
  pdDate.setHours(0, 0, 0, 0);
  if (pdDate <= today) {
    await this.paymentDayRepo.update(pd.id, {
      status: PaymentDayStatus.PENDING,
      paymentId: newPayment.id,
    });
  }
}
```

### 5G. Update: `payPayment()` (line 362-417)

Setelah invoice di-mark PAID (line 380-383), tambah sebelum creditDayToContract:

```typescript
// BARU: Update PaymentDay records → PAID
if (payment.type === InvoiceType.DAILY_BILLING || payment.type === InvoiceType.MANUAL_PAYMENT) {
  await this.paymentDayRepo.updateManyByPaymentId(payment.id, {
    status: PaymentDayStatus.PAID,
  });
}
```

> Setelah ini, TETAP panggil `creditDayToContract()` yang existing. Nantinya bisa diganti dengan `syncContractFromPaymentDays()`, tapi untuk backward compatibility biarkan keduanya dulu.

### 5H. Update: `voidPayment()` (line 817-844)

Setelah invoice di-mark VOID (line 828):

```typescript
// BARU: Kembalikan PaymentDay ke UNPAID
await this.paymentDayRepo.updateManyByPaymentId(paymentId, {
  status: PaymentDayStatus.UNPAID,
  paymentId: null,
});
```

### 5I. Update: `cancelPayment()` (line 573-609)

Setelah payment di-void (line 578-580):

```typescript
// BARU: Kembalikan PaymentDay ke UNPAID
await this.paymentDayRepo.updateManyByPaymentId(paymentId, {
  status: PaymentDayStatus.UNPAID,
  paymentId: null,
});
```

Jika previous payment reactivated (line 583-590), setelah reactivation:

```typescript
// BARU: Link PaymentDay ke reactivated previous payment
if (previous && previous.periodStart && previous.periodEnd) {
  let d = new Date(previous.periodStart);
  d.setHours(0, 0, 0, 0);
  const end = new Date(previous.periodEnd);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    if (!this.isLiburBayar((await this.contractRepo.findById(payment.contractId)) as Contract, d)) {
      await this.paymentDayRepo.updateByContractAndDate(payment.contractId, d, {
        status: PaymentDayStatus.PENDING,
        paymentId: previous.id,
      });
    }
    d.setDate(d.getDate() + 1);
  }
}
```

### 5J. Update: `revertPaymentStatus()` (line 884-923)

Jika reverting dari PAID (line 894-896), tambah sebelum `revertPaymentFromContract`:

```typescript
// BARU: Kembalikan PaymentDay ke UNPAID
await this.paymentDayRepo.updateManyByPaymentId(payment.id, {
  status: PaymentDayStatus.UNPAID,
  paymentId: null,
});
```

### 5K. Update: `createManualPayment()` (line 473-569)

Setelah period calculation (setelah line 501, sebelum check existingActive):

```typescript
// BARU: Ensure PaymentDay records exist untuk seluruh period
const periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;
await this.generatePaymentDaysForPeriod(contract, periodStart, periodDays);
```

Jika existingActive di-void (line 512-513):

```typescript
// BARU: Unlink PaymentDay dari existing active
await this.paymentDayRepo.updateManyByPaymentId(existingActive.id, {
  status: PaymentDayStatus.UNPAID,
  paymentId: null,
});
```

Setelah new merged payment created (line 548):

```typescript
// BARU: Link semua working days ke new payment
let linkCursor = new Date(mergedPeriodStart);
linkCursor.setHours(0, 0, 0, 0);
const linkEnd = new Date(periodEnd);
linkEnd.setHours(0, 0, 0, 0);
while (linkCursor <= linkEnd) {
  if (!this.isLiburBayar(contract, linkCursor)) {
    await this.paymentDayRepo.updateByContractAndDate(contract.id, linkCursor, {
      status: PaymentDayStatus.PENDING,
      paymentId: created.id,
    });
  }
  linkCursor.setDate(linkCursor.getDate() + 1);
}
```

### 5L. REWRITE: `getCalendarData()` (line 613-703)

Ganti seluruh method body:

```typescript
async getCalendarData(contractId: string, year: number, month: number): Promise<CalendarDay[]> {
  const contract = await this.contractRepo.findById(contractId);
  if (!contract) throw new Error('Contract not found');

  const startDate = new Date(year, month - 1, 1);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(year, month, 0);
  endDate.setHours(0, 0, 0, 0);
  const daysInMonth = endDate.getDate();

  const today = getWibToday();

  const paymentDays = await this.paymentDayRepo.findByContractAndDateRange(contractId, startDate, endDate);

  const dayMap = new Map<string, PaymentDay>();
  paymentDays.forEach(pd => {
    dayMap.set(toDateKey(pd.date), pd);
  });

  const result: CalendarDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    date.setHours(0, 0, 0, 0);
    const dateKey = toDateKey(date);

    const pd = dayMap.get(dateKey);

    if (!pd) {
      result.push({ date: dateKey, status: 'not_issued' });
      continue;
    }

    switch (pd.status) {
      case PaymentDayStatus.PAID:
        result.push({ date: dateKey, status: 'paid', amount: pd.amount });
        break;
      case PaymentDayStatus.PENDING:
        result.push({ date: dateKey, status: 'pending', amount: pd.amount });
        break;
      case PaymentDayStatus.HOLIDAY:
        result.push({ date: dateKey, status: 'holiday' });
        break;
      case PaymentDayStatus.VOIDED:
        result.push({ date: dateKey, status: 'voided' });
        break;
      case PaymentDayStatus.UNPAID:
        result.push({
          date: dateKey,
          status: date < today ? 'overdue' : 'not_issued',
          amount: pd.amount,
        });
        break;
    }
  }

  return result;
}
```

Update interface `CalendarDay` (line 21-25) juga:

```typescript
export interface CalendarDay {
  date: string;
  status: 'paid' | 'pending' | 'overdue' | 'holiday' | 'not_issued' | 'voided';
  amount?: number;
}
```

### 5M. Method Baru: `updatePaymentDayStatus()` — Admin Correction

```typescript
async updatePaymentDayStatus(
  contractId: string,
  date: Date,
  newStatus: PaymentDayStatus,
  adminId: string,
  notes?: string,
): Promise<PaymentDay> {
  date.setHours(0, 0, 0, 0);
  const pd = await this.paymentDayRepo.findByContractAndDate(contractId, date);
  if (!pd) throw new Error('PaymentDay not found for this date');

  if (pd.status === PaymentDayStatus.VOIDED) {
    throw new Error('Cannot modify a voided day');
  }

  const updated = await this.paymentDayRepo.update(pd.id, {
    status: newStatus,
    notes: notes || pd.notes,
    paymentId: newStatus === PaymentDayStatus.UNPAID ? null : pd.paymentId,
    amount: newStatus === PaymentDayStatus.HOLIDAY ? 0 : pd.dailyRate,
  });
  if (!updated) throw new Error('Failed to update PaymentDay');

  await this.syncContractFromPaymentDays(contractId);

  await this.auditRepo.create({
    id: uuidv4(),
    userId: adminId,
    action: AuditAction.UPDATE,
    module: 'payment_day',
    entityId: pd.id,
    description: `Admin correction: ${pd.status} → ${newStatus} for ${toDateKey(date)}`,
    metadata: { contractId, date: toDateKey(date), oldStatus: pd.status, newStatus, notes },
    ipAddress: '',
    createdAt: new Date(),
  });

  return updated;
}
```

### 5N. Method Baru: `reducePayment()` — Partial Payment / Pengurangan Tagihan

Fitur ini memungkinkan admin mengurangi jumlah hari pada tagihan aktif. Sisa hari kembali ke UNPAID dan akan otomatis di-pickup oleh rollover berikutnya.

```typescript
/**
 * Kurangi tagihan aktif menjadi sejumlah hari tertentu.
 * Sisa hari yang tidak ter-cover kembali ke UNPAID → akan di-pickup rollover besok.
 *
 * Flow:
 * 1. Void invoice lama → semua PaymentDay-nya kembali ke UNPAID
 * 2. Buat invoice baru dengan newDaysCount hari (ambil dari hari paling awal)
 * 3. Link PaymentDay yang ter-cover → PENDING
 * 4. Sisa PaymentDay tetap UNPAID → rollover otomatis besok
 */
async reducePayment(
  paymentId: string,
  newDaysCount: number,
  adminId: string,
  notes?: string,
): Promise<Invoice> {
  const payment = await this.invoiceRepo.findById(paymentId);
  if (!payment) throw new Error('Payment not found');
  if (payment.status !== PaymentStatus.PENDING) {
    throw new Error('Can only reduce PENDING payments');
  }
  if (newDaysCount < 1) throw new Error('newDaysCount must be at least 1');
  if (newDaysCount >= payment.daysCount) {
    throw new Error('newDaysCount must be less than current daysCount');
  }

  const contract = await this.contractRepo.findById(payment.contractId);
  if (!contract) throw new Error('Contract not found');

  // Step 1: Void invoice lama
  await this.invoiceRepo.update(payment.id, { status: PaymentStatus.VOID });

  // Unlink semua PaymentDay dari invoice lama → UNPAID
  await this.paymentDayRepo.updateManyByPaymentId(payment.id, {
    status: PaymentDayStatus.UNPAID,
    paymentId: null,
  });

  // Step 2: Ambil PaymentDay UNPAID, sorted by date ascending
  // Pilih newDaysCount hari paling awal
  const allUnpaid = await this.paymentDayRepo.findByContractAndStatus(
    contract.id,
    PaymentDayStatus.UNPAID,
  );
  const eligibleDays = allUnpaid
    .filter(pd => {
      const d = new Date(pd.date);
      d.setHours(0, 0, 0, 0);
      return d <= getWibToday();
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, newDaysCount);

  if (eligibleDays.length === 0) throw new Error('No eligible UNPAID days found');

  const periodStart = new Date(eligibleDays[0].date);
  const periodEnd = new Date(eligibleDays[eligibleDays.length - 1].date);
  const totalAmount = eligibleDays.reduce((sum, pd) => sum + pd.amount, 0);

  // Step 3: Buat invoice baru
  const newPayment: Invoice = {
    id: uuidv4(),
    invoiceNumber: generatePaymentNumber(), // PMT-YYMMDD-NNNN
    contractId: contract.id,
    type: InvoiceType.DAILY_BILLING,
    status: PaymentStatus.PENDING,
    amount: totalAmount,
    dailyRate: contract.dailyRate,
    daysCount: eligibleDays.length,
    periodStart,
    periodEnd,
    previousPaymentId: payment.id,
    isHoliday: false,
    // ... other fields sesuai pattern createDailyPayment()
    description: `Reduced payment: ${eligibleDays.length} days (from ${payment.daysCount} days)`,
    paidAt: null,
    expiredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const created = await this.invoiceRepo.create(newPayment);

  // Step 4: Link PaymentDay yang ter-cover ke invoice baru → PENDING
  for (const pd of eligibleDays) {
    await this.paymentDayRepo.update(pd.id, {
      status: PaymentDayStatus.PENDING,
      paymentId: created.id,
    });
  }

  // Audit log
  await this.auditRepo.create({
    id: uuidv4(),
    userId: adminId,
    action: AuditAction.UPDATE,
    module: 'payment',
    entityId: created.id,
    description: `Reduced payment from ${payment.daysCount} days to ${eligibleDays.length} days. Old: ${payment.invoiceNumber}, New: ${created.invoiceNumber}`,
    metadata: {
      oldPaymentId: payment.id,
      newPaymentId: created.id,
      oldDaysCount: payment.daysCount,
      newDaysCount: eligibleDays.length,
      remainingUnpaidDays: allUnpaid.length - eligibleDays.length,
      notes,
    },
    ipAddress: '',
    createdAt: new Date(),
  });

  return created;
}
```

**Sisa hari yang tidak ter-cover:**

- Tetap `UNPAID` di PaymentDay → terlihat merah di kalender (karena `date < today`)
- Besok saat scheduler `generateDailyPayments()` jalan, semua UNPAID days (termasuk sisa ini + hari baru) akan otomatis akumulasi ke invoice baru (Opsi B)
- Tidak perlu logic tambahan — rollover existing sudah handle ini

---

## LANGKAH 6: CONTRACTSERVICE — CHANGES

**File**: `packages/backend/src/application/services/ContractService.ts`

### 6A. Constructor — Tambah Parameter

Tambah `paymentDayRepo: IPaymentDayRepository` sebagai parameter ke-4 (setelah invoiceRepo):

```typescript
// SEBELUM:
constructor(
  private contractRepo: IContractRepository,
  private customerRepo: ICustomerRepository,
  private invoiceRepo: IInvoiceRepository,
  private auditRepo: IAuditLogRepository,
  private settingService?: SettingService,
) {}

// SESUDAH:
constructor(
  private contractRepo: IContractRepository,
  private customerRepo: ICustomerRepository,
  private invoiceRepo: IInvoiceRepository,
  private paymentDayRepo: IPaymentDayRepository,
  private auditRepo: IAuditLogRepository,
  private settingService?: SettingService,
) {}
```

Import yang perlu ditambah:

```typescript
import { IPaymentDayRepository } from '../../domain/interfaces';
import { PaymentDayStatus } from '../../domain/enums';
```

### 6B. Update: `receiveUnit()`

Setelah set `billingStartDate` dan update contract, tambahkan logic generate initial PaymentDay records. Cari lokasi tepat setelah `await this.contractRepo.update(...)` di method receiveUnit:

```typescript
// BARU: Generate PaymentDay records untuk 60 hari ke depan dari billingStartDate
const billingStart = new Date(/* billingStartDate yang baru di-set */);
billingStart.setHours(0, 0, 0, 0);
// Import atau akses isLiburBayar via helper
const records: PaymentDay[] = [];
const cursor = new Date(billingStart);
for (let i = 0; i < 60; i++) {
  const d = new Date(cursor);
  d.setHours(0, 0, 0, 0);
  // Determine holiday berdasarkan contract.holidayScheme
  const isSunday = d.getDay() === 0;
  const isDate29Plus = d.getDate() > 28;
  const isHoliday = contract.holidayScheme === HolidayScheme.OLD_CONTRACT ? isSunday : isDate29Plus;

  records.push({
    id: uuidv4(),
    contractId: contract.id,
    date: d,
    status: isHoliday ? PaymentDayStatus.HOLIDAY : PaymentDayStatus.UNPAID,
    paymentId: null,
    dailyRate: contract.dailyRate,
    amount: isHoliday ? 0 : contract.dailyRate,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  cursor.setDate(cursor.getDate() + 1);
}
if (records.length > 0) {
  await this.paymentDayRepo.createMany(records);
}
```

> Alternatif yang lebih clean: buat method ini public di PaymentService dan panggil dari sini. Tapi itu melanggar layer dependency (ContractService seharusnya tidak depend pada PaymentService). Jadi duplikasi logic sedikit di sini acceptable, ATAU extract ke shared utility di domain layer.

### 6C. Update: `cancelContract()`

Setelah void semua pending/failed invoices, tambah:

```typescript
// BARU: Void semua UNPAID dan PENDING PaymentDays
const unpaidDays = await this.paymentDayRepo.findByContractAndStatus(
  contractId,
  PaymentDayStatus.UNPAID,
);
const pendingDays = await this.paymentDayRepo.findByContractAndStatus(
  contractId,
  PaymentDayStatus.PENDING,
);
for (const day of [...unpaidDays, ...pendingDays]) {
  await this.paymentDayRepo.update(day.id, {
    status: PaymentDayStatus.VOIDED,
    paymentId: null,
  });
}
```

### 6D. Update: `repossess()`

Sama persis dengan cancelContract — void semua UNPAID/PENDING PaymentDays. Copy-paste logic yang sama.

---

## LANGKAH 7: API ENDPOINT — ADMIN CORRECTION

### 7A. Controller

**File**: `packages/backend/src/presentation/controllers/PaymentController.ts`

Tambah method baru:

```typescript
updatePaymentDayStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contractId, date } = req.params;
    const { status, notes } = req.body;
    const adminId = (req as any).userId || 'system';

    const parsedDate = new Date(date + 'T00:00:00');
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const result = await this.paymentService.updatePaymentDayStatus(
      contractId,
      parsedDate,
      status,
      adminId,
      notes,
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};
```

### 7B. Controller — Reduce Payment

Tambah method baru di `PaymentController.ts`:

```typescript
reducePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newDaysCount, notes } = req.body;
    const adminId = (req as any).userId || 'system';

    if (!newDaysCount || typeof newDaysCount !== 'number' || newDaysCount < 1) {
      return res.status(400).json({ error: 'newDaysCount must be a positive number' });
    }

    const result = await this.paymentService.reducePayment(id, newDaysCount, adminId, notes);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
```

### 7C. Routes

**File**: `packages/backend/src/presentation/routes/index.ts`

Tambah setelah route calendar (setelah line yang berisi `/payments/contract/:contractId/calendar`):

```typescript
// Admin correction: ubah status PaymentDay tertentu
router.patch(
  '/payments/contract/:contractId/day/:date',
  authMiddleware,
  controllers.paymentController.updatePaymentDayStatus,
);

// Partial payment: kurangi jumlah hari pada tagihan aktif
router.post('/payments/:id/reduce', authMiddleware, controllers.paymentController.reducePayment);
```

---

## LANGKAH 8: SCHEDULER

**File**: `packages/backend/src/infrastructure/scheduler.ts`

Di method `runDailyTasks()`, tambahkan sebagai step PERTAMA (sebelum rollover):

```typescript
async runDailyTasks(): Promise<void> {
  // BARU: Extend PaymentDay records 30 hari ke depan
  await this.paymentService.extendPaymentDayRecords();

  // Existing (urutan tidak berubah):
  await this.paymentService.rolloverExpiredPayments();
  await this.paymentService.generateDailyPayments();
  await this.contractService.checkAndUpdateOverdueContracts();
}
```

---

## LANGKAH 9: FRONTEND CHANGES

### 9A. Types

**File**: `packages/frontend/src/types/index.ts`

Tambah enum:

```typescript
export enum PaymentDayStatus {
  UNPAID = 'UNPAID',
  PENDING = 'PENDING',
  PAID = 'PAID',
  HOLIDAY = 'HOLIDAY',
  VOIDED = 'VOIDED',
}
```

### 9B. PaymentCalendar Component

**File**: `packages/frontend/src/components/PaymentCalendar.tsx`

Update `CalendarDay` interface:

```typescript
interface CalendarDay {
  date: string;
  status: 'paid' | 'pending' | 'overdue' | 'holiday' | 'not_issued' | 'voided';
  amount?: number;
}
```

Tambah handling warna untuk `voided` di mapping status → CSS class:

```typescript
// Di bagian status color mapping, tambah case:
case 'voided':
  return 'bg-gray-400 text-white'; // abu-abu gelap
```

Tambah di legend:

```typescript
{ key: 'voided', label: 'Dibatalkan', color: 'bg-gray-400', count: /* hitung dari data */ }
```

### 9C. API Client

**File**: `packages/frontend/src/lib/api.ts`

Tambah method:

```typescript
async updatePaymentDayStatus(contractId: string, date: string, status: string, notes?: string) {
  return this.request<any>(`/payments/contract/${contractId}/day/${date}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
}
```

---

## LANGKAH 10: TESTING

**File**: `packages/backend/src/__tests__/PaymentService.test.ts`

### 10A. Update Test Setup

Di beforeEach, tambah `InMemoryPaymentDayRepository`:

```typescript
import { InMemoryPaymentDayRepository } from '../infrastructure/repositories/InMemoryPaymentDayRepository';
import { PaymentDayStatus } from '../domain/enums';

// Di dalam describe block:
let paymentDayRepo: InMemoryPaymentDayRepository;

beforeEach(() => {
  contractRepo = new InMemoryContractRepository();
  invoiceRepo = new InMemoryInvoiceRepository();
  auditRepo = new InMemoryAuditLogRepository();
  paymentDayRepo = new InMemoryPaymentDayRepository(); // BARU

  // Update constructor call:
  paymentService = new PaymentService(invoiceRepo, contractRepo, paymentDayRepo, auditRepo);
});
```

### 10B. Update Test di ContractService.test.ts

`ContractService` constructor juga berubah — tambah `paymentDayRepo` parameter:

```typescript
import { InMemoryPaymentDayRepository } from '../infrastructure/repositories/InMemoryPaymentDayRepository';

let paymentDayRepo: InMemoryPaymentDayRepository;

beforeEach(() => {
  // ... existing ...
  paymentDayRepo = new InMemoryPaymentDayRepository();
  contractService = new ContractService(
    contractRepo,
    customerRepo,
    invoiceRepo,
    paymentDayRepo,
    auditRepo,
    settingService,
  );
});
```

### 10C. Test Cases Baru

Tambahkan describe block baru di `PaymentService.test.ts`:

```
describe('PaymentDay Management', () => {
  describe('generatePaymentDaysForPeriod', () => {
    it('should generate PaymentDay records for given period')
    it('should mark holiday dates as HOLIDAY with amount=0')
    it('should mark working dates as UNPAID with amount=dailyRate')
    it('should be idempotent — not duplicate existing records')
  })

  describe('Daily Payment + PaymentDay', () => {
    it('should update PaymentDay to PENDING when daily payment generated')
    it('should update PaymentDay to PAID when payment confirmed')
  })

  describe('Rollover + PaymentDay', () => {
    it('should unlink PaymentDays from expired payment (→ UNPAID)')
    it('should link PaymentDays to new rollover payment (→ PENDING)')
  })

  describe('Revert + PaymentDay', () => {
    it('should revert PaymentDay to UNPAID when payment reverted from PAID')
  })

  describe('Cancel Payment + PaymentDay', () => {
    it('should revert PaymentDay to UNPAID when payment cancelled')
    it('should relink PaymentDay to previous payment when merged payment cancelled')
  })

  describe('Manual Payment + PaymentDay', () => {
    it('should create PaymentDay records for manual payment period')
    it('should handle merge — unlink old, link new')
  })

  describe('Admin Correction', () => {
    it('should change PaymentDay status (PAID → UNPAID)')
    it('should change PaymentDay status (UNPAID → HOLIDAY)')
    it('should reject modification of VOIDED days')
    it('should sync contract summary after correction')
  })

  describe('Gap Billing — Opsi B (Akumulasi UNPAID)', () => {
    it('should accumulate all UNPAID past dates + today into one invoice')
    it('should handle gap scenario: PAID → UNPAID → HOLIDAY → PAID → today')
    it('should not include PAID or HOLIDAY days in accumulated invoice')
    it('should calculate correct amount from sum of UNPAID PaymentDay amounts')
    it('should set periodStart to earliest UNPAID and periodEnd to latest')
  })

  describe('Reduce Payment (Partial Payment)', () => {
    it('should void old invoice and create new with fewer days')
    it('should keep remaining days as UNPAID')
    it('should reject if newDaysCount >= current daysCount')
    it('should reject if payment is not PENDING')
    it('should pick earliest UNPAID days for the reduced invoice')
    it('should allow rollover to pick up remaining UNPAID days next day')
  })

  describe('Calendar from PaymentDay', () => {
    it('should return calendar data from PaymentDay records')
    it('should show UNPAID past dates as overdue')
    it('should show UNPAID future dates as not_issued')
    it('should show VOIDED as voided')
  })

  describe('syncContractFromPaymentDays', () => {
    it('should correctly calculate totalDaysPaid from PAID + HOLIDAY records')
    it('should correctly calculate workingDaysPaid from PAID only')
    it('should correctly calculate holidayDaysPaid from HOLIDAY only')
    it('should determine endDate from last PAID/HOLIDAY date')
    it('should mark contract COMPLETED when target reached')
  })
})
```

---

## LANGKAH 11: DATA MIGRATION (EXISTING CONTRACTS)

Untuk kontrak yang sudah berjalan, buat migration method di PaymentService:

```typescript
async migrateExistingContracts(): Promise<number> {
  const today = getWibToday();
  const contracts = await this.contractRepo.findAll();
  let migrated = 0;

  for (const contract of contracts) {
    if (!contract.billingStartDate) continue;

    const billingStart = new Date(contract.billingStartDate);
    billingStart.setHours(0, 0, 0, 0);
    const endDate = new Date(contract.endDate);
    endDate.setHours(0, 0, 0, 0);

    const targetEnd = new Date(today);
    targetEnd.setDate(targetEnd.getDate() + 30);

    let current = new Date(billingStart);
    while (current <= targetEnd) {
      const d = new Date(current);
      d.setHours(0, 0, 0, 0);

      const existing = await this.paymentDayRepo.findByContractAndDate(contract.id, d);
      if (!existing) {
        const isHoliday = this.isLiburBayar(contract, d);

        let status: PaymentDayStatus;
        if (isHoliday) {
          status = PaymentDayStatus.HOLIDAY;
        } else if (d <= endDate && contract.totalDaysPaid > 0) {
          status = PaymentDayStatus.PAID;
        } else {
          status = PaymentDayStatus.UNPAID;
        }

        // Check PENDING
        if (status === PaymentDayStatus.UNPAID) {
          const activePayment = await this.invoiceRepo.findActiveByContractId(contract.id);
          if (activePayment && activePayment.periodStart && activePayment.periodEnd) {
            const ps = new Date(activePayment.periodStart);
            ps.setHours(0, 0, 0, 0);
            const pe = new Date(activePayment.periodEnd);
            pe.setHours(0, 0, 0, 0);
            if (d >= ps && d <= pe) {
              status = PaymentDayStatus.PENDING;
            }
          }
        }

        await this.paymentDayRepo.create({
          id: uuidv4(),
          contractId: contract.id,
          date: d,
          status,
          paymentId: null,
          dailyRate: contract.dailyRate,
          amount: isHoliday ? 0 : contract.dailyRate,
          notes: status === PaymentDayStatus.PAID ? 'Migrated from legacy data' : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      current.setDate(current.getDate() + 1);
    }

    // Void future days untuk cancelled/repossessed contracts
    if (contract.status === ContractStatus.CANCELLED || contract.status === ContractStatus.REPOSSESSED) {
      const unpaidDays = await this.paymentDayRepo.findByContractAndStatus(contract.id, PaymentDayStatus.UNPAID);
      for (const day of unpaidDays) {
        await this.paymentDayRepo.update(day.id, { status: PaymentDayStatus.VOIDED });
      }
    }

    migrated++;
  }

  return migrated;
}
```

Opsi trigger: tambahkan ke seed script atau buat endpoint admin satu kali.

---

## URUTAN IMPLEMENTASI (WAJIB DIIKUTI)

1. Prisma Schema (Langkah 1) → `npx prisma generate`
2. Domain Layer — enum, entity, interface (Langkah 2)
3. InMemoryPaymentDayRepository (Langkah 3A)
4. PrismaPaymentDayRepository (Langkah 3B)
5. Barrel exports — repositories, entities, interfaces (Langkah 3C, 2C, 2E)
6. Wiring di index.ts (Langkah 4)
7. PaymentService — semua perubahan (Langkah 5)
8. ContractService — semua perubahan (Langkah 6)
9. API endpoint + route (Langkah 7)
10. Scheduler update (Langkah 8)
11. Tests — update existing setup + tambah test baru (Langkah 10)
12. Frontend changes (Langkah 9)
13. Migration method (Langkah 11)
14. Validasi: `cd packages/backend && npx tsc --noEmit`
15. Validasi: `cd packages/frontend && npx tsc --noEmit`
16. Validasi: `cd packages/backend && npm test`

---

## CHECKLIST FINAL

- [ ] Prisma schema: enum `PaymentDayStatus` + model `PaymentDay` + relasi di Contract & Invoice
- [ ] `npx prisma generate` berhasil
- [ ] Domain: entity `PaymentDay`, enum `PaymentDayStatus`, interface `IPaymentDayRepository`
- [ ] Barrel exports updated (entities, interfaces, repositories)
- [ ] InMemoryPaymentDayRepository: semua methods implemented
- [ ] PrismaPaymentDayRepository: semua methods implemented
- [ ] index.ts: repo wired, injected ke PaymentService & ContractService
- [ ] PaymentService constructor: menerima `paymentDayRepo` (parameter ke-3, setelah contractRepo)
- [ ] ContractService constructor: menerima `paymentDayRepo` (parameter ke-4, setelah invoiceRepo)
- [ ] `generatePaymentDaysForPeriod()`: public, idempotent, holiday detection
- [ ] `extendPaymentDayRecords()`: 30 hari ke depan untuk semua ACTIVE/OVERDUE contracts
- [ ] `syncContractFromPaymentDays()`: recalculate totalDaysPaid, workingDaysPaid, holidayDaysPaid, endDate, progress
- [ ] `generateDailyPayments()`: Opsi B — akumulasi semua UNPAID past dates + hari ini ke satu invoice
- [ ] `rolloverPayment()`: Opsi B — unlink expired + link semua UNPAID (termasuk gap) ke new payment
- [ ] `payPayment()`: update PaymentDay → PAID
- [ ] `voidPayment()`: update PaymentDay → UNPAID
- [ ] `cancelPayment()`: update PaymentDay → UNPAID + handle reactivation
- [ ] `revertPaymentStatus()`: update PaymentDay → UNPAID
- [ ] `createManualPayment()`: ensure records + link
- [ ] `getCalendarData()`: rewritten — query PaymentDay, bukan kalkulasi
- [ ] `updatePaymentDayStatus()`: admin correction + audit log
- [ ] `reducePayment()`: partial payment — void lama, buat baru dengan fewer days, sisa UNPAID
- [ ] ContractService `receiveUnit()`: generate 60 hari initial records
- [ ] ContractService `cancelContract()`: void UNPAID/PENDING days
- [ ] ContractService `repossess()`: void UNPAID/PENDING days
- [ ] Scheduler: `extendPaymentDayRecords()` sebagai step pertama
- [ ] API route: `PATCH /payments/contract/:contractId/day/:date` (admin correction)
- [ ] API route: `POST /payments/:id/reduce` (partial payment)
- [ ] Frontend: CalendarDay status include `voided`, warna abu-abu gelap
- [ ] Frontend types: `PaymentDayStatus` enum
- [ ] Frontend API client: `updatePaymentDayStatus()` method
- [ ] Tests: PaymentService constructor updated (semua test suites)
- [ ] Tests: ContractService constructor updated (semua test suites)
- [ ] Tests: 30+ new test cases untuk PaymentDay (termasuk gap billing + partial payment)
- [ ] `npx tsc --noEmit` (backend) — NO errors
- [ ] `npx tsc --noEmit` (frontend) — NO errors
- [ ] `npm test` (backend) — ALL tests pass
- [ ] Migration method tersedia untuk existing contracts

---

## CATATAN PENTING

1. **Backward compatibility**: Method `creditDayToContract()` dan `revertPaymentFromContract()` TETAP dipertahankan selama transisi. Keduanya tetap dipanggil di flow yang sudah ada. `syncContractFromPaymentDays()` adalah tambahan, bukan pengganti langsung. Penggantian penuh bisa dilakukan di fase berikutnya.

2. **Field baru di Contract**: `workingDaysPaid` dan `holidayDaysPaid` sudah ada di entity dan schema. `creditDayToContract()` sudah update kedua field ini (line 454-460). `syncContractFromPaymentDays()` juga HARUS update kedua field ini.

3. **Performance**: Dengan index `@@unique([contractId, date])` dan `@@index([contractId, status])`, query calendar (findByContractAndDateRange) dan count operations akan sangat cepat. Kontrak dengan 1278 hari = ~1300 records per kontrak — sangat manageable.

4. **Idempotency**: `generatePaymentDaysForPeriod()` WAJIB idempotent — cek existing sebelum create. Scheduler bisa restart berulang kali.

5. **Timezone**: Field `date` di PaymentDay selalu midnight (00:00:00). Gunakan `setHours(0,0,0,0)` sebelum save. Untuk "hari ini", tetap gunakan `getWibToday()`.

6. **`isLiburBayar()` tetap digunakan** saat GENERATE PaymentDay records baru. Setelah record dibuat, status HOLIDAY immutable — tidak berubah meskipun holidayScheme contract berubah. Inilah keunggulan static vs dynamic.

7. **Jangan hapus field `totalDaysPaid`, `endDate`, `ownershipProgress`, `workingDaysPaid`, `holidayDaysPaid` dari Contract**. Mereka tetap sebagai **cache** yang di-maintain oleh `creditDayToContract()` (existing) dan `syncContractFromPaymentDays()` (baru).

8. **Gap Billing (Opsi B)**: `generateDailyPayments()` dan `rolloverPayment()` WAJIB query semua PaymentDay `UNPAID` yang `date <= today` — bukan hanya hari ini. Ini menangani skenario di mana admin melakukan koreksi (revert PAID → UNPAID) atau partial payment (sisa hari kembali ke UNPAID). Semua hari UNPAID yang tertinggal akan otomatis masuk ke tagihan berikutnya.

9. **Partial Payment (`reducePayment`)**: Reuse pattern void + create baru. Tidak perlu status baru atau model baru. Sisa hari yang tidak ter-cover kembali ke UNPAID dan rollover otomatis akan pickup besok. Ini juga bekerja dengan Opsi B — rollover akan akumulasi semua UNPAID (termasuk sisa partial) + hari baru.
