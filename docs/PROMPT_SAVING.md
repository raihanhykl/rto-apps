# PROMPT: Implementasi Fitur Saving — Dana Sisihan Per Kontrak untuk WEDISON RTO

---

## META

- **Tujuan**: Menambahkan fitur Saving yang secara otomatis menyisihkan Rp 5.000 per hari kerja dari setiap pembayaran harian customer, disimpan sebagai saldo saving per kontrak, dan bisa digunakan untuk service motor, balik nama STNK/BPKB, atau di-claim setelah kontrak selesai.
- **Prasyarat**: Baca `CLAUDE.md` sebelum mulai. Semua aturan arsitektur, konvensi, dan bisnis logik di sana WAJIB diikuti.
- **Scope**: Backend (domain, application, infrastructure, presentation) + Frontend (contract detail page, types, API) + Tests.
- **Bahasa komunikasi**: Bahasa Indonesia untuk semua output teks ke user.

---

## KONTEKS BISNIS

### Apa Itu Saving?

Di setiap pembayaran tagihan harian, nominal yang dibayarkan customer **sudah termasuk saving sebesar Rp 5.000 per hari kerja**. Ini berlaku flat untuk **semua jenis motor dan tipe baterai** WEDISON.

**Contoh perhitungan:**

```
Customer A membayar tagihan 10 hari kerja.
Daily rate: Rp 58.000 (Athena Regular)
Total tagihan: 10 × Rp 58.000 = Rp 580.000
Dari jumlah itu, Rp 5.000 × 10 = Rp 50.000 masuk ke saving.
```

**PENTING — Saving bukan potongan:**

- Customer tetap membayar Rp 58.000 penuh per hari. Daily rate TIDAK berubah.
- Saving adalah **sebagian dari pembayaran** yang disisihkan secara internal.
- Dari perspektif customer: "Rp 5.000/hari otomatis ditabung dari pembayaran saya."
- Dari perspektif sistem: saat invoice PAID, credit saving = `SAVING_PER_DAY × daysCount` (working days only).

### Kapan Saving Ter-credit?

| Event                                      | Saving Di-credit? | Penjelasan                                           |
| ------------------------------------------ | ----------------- | ---------------------------------------------------- |
| Invoice `DAILY_BILLING` di-PAID            | ✅ YA             | `5000 × daysCount` (hanya working days yang dibayar) |
| Invoice `MANUAL_PAYMENT` di-PAID           | ✅ YA             | `5000 × daysCount`                                   |
| Invoice `DP` / `DP_INSTALLMENT` di-PAID    | ❌ TIDAK          | DP bukan pembayaran harian                           |
| Holiday payment (isHoliday=true, amount=0) | ❌ TIDAK          | Tidak ada pembayaran aktual                          |
| Invoice di-revert dari PAID → PENDING      | 🔄 REVERSAL       | Saving yang sudah di-credit harus di-reverse         |

### Kegunaan Saving

**1. Service Motor (DEBIT_SERVICE)**
Saat customer service motor di service center WEDISON, saving bisa digunakan untuk membayar/memotong biaya servis, spare part, dll.

- Contoh: saving Rp 500.000, biaya servis Rp 300.000 → saving dipotong jadi Rp 200.000.
- Tersedia saat kontrak berstatus: `ACTIVE`, `OVERDUE`, atau `COMPLETED`.

**2. Biaya Balik Nama STNK & BPKB (DEBIT_TRANSFER)**
Saat kontrak selesai (COMPLETED), biaya pemindahan kepemilikan kendaraan bisa menggunakan saving.

- Tersedia **HANYA** saat kontrak berstatus: `COMPLETED`.

**3. Claim Sisa Saving (DEBIT_CLAIM)**
Saat kontrak COMPLETED dan masih ada sisa saving, customer bisa claim (tarik tunai) sisa saving.

- Tersedia **HANYA** saat kontrak berstatus: `COMPLETED`.
- **PENGECUALIAN**: Customer **TIDAK BISA** claim jika kontrak berakhir karena `REPOSSESSED` atau `CANCELLED`. Saving hangus (forfeited) — tapi **record tetap ada** di database untuk audit trail.

---

## KEPUTUSAN DESAIN

### Keputusan 1: Saving = Explicit Records, Bukan Derived

**Konteks**: Saving bisa dihitung secara derived (`totalDaysPaid × 5000 - totalDebit`) atau disimpan sebagai explicit transaction records.

**Keputusan**: Gunakan **explicit records** — setiap perubahan saldo saving (masuk/keluar) dicatat sebagai `SavingTransaction` di database.

**Alasan**:

1. **Audit trail lengkap** — setiap transaksi saving (credit, debit, reversal) punya record sendiri dengan timestamp, admin, deskripsi, foto bukti.
2. **Balance verification** — `balanceBefore` dan `balanceAfter` di setiap transaksi memudahkan deteksi discrepancy.
3. **Debit bisa beragam** — service motor, balik nama, claim masing-masing punya metadata berbeda.
4. **Reversal traceable** — saat payment di-revert, saving reversal bisa dilacak ke transaksi credit awalnya.

### Keputusan 2: Denormalized Balance di Contract

**Konteks**: Query saldo saving bisa dilakukan via `SUM(credit) - SUM(debit)` setiap kali, atau disimpan sebagai field denormalized di Contract.

**Keputusan**: Simpan **`savingBalance`** di model `Contract` sebagai denormalized field.

**Alasan**:

1. Quick read tanpa aggregation query — saldo saving sering ditampilkan di halaman detail kontrak.
2. Di-maintain otomatis setiap ada `SavingTransaction` baru (credit/debit).
3. **Source of truth tetap `SavingTransaction`** — jika ada discrepancy, recalculate dari transaction log.

### Keputusan 3: Saving per Kontrak, Bukan per Customer

**Konteks**: Customer bisa punya lebih dari 1 kontrak. Saving bisa di-pool per customer atau terpisah per kontrak.

**Keputusan**: Saving **per kontrak** — setiap kontrak punya saldo saving sendiri.

**Alasan**:

1. Saving di-generate dari pembayaran kontrak spesifik.
2. Claim tergantung status kontrak (COMPLETED = bisa claim, REPOSSESSED = tidak).
3. Satu customer dengan kontrak A (COMPLETED) dan kontrak B (REPOSSESSED) → bisa claim saving A, tidak bisa claim saving B.

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

| File                                                                                      | Perubahan                                                                                              |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/backend/prisma/schema.prisma`                                                   | Tambah enum `SavingTransactionType` + model `SavingTransaction` + update `Contract` + update `Invoice` |
| `packages/backend/src/domain/enums/index.ts`                                              | Tambah enum `SavingTransactionType` + konstanta `SAVING_PER_DAY`                                       |
| `packages/backend/src/domain/entities/SavingTransaction.ts`                               | **BARU** — entity interface                                                                            |
| `packages/backend/src/domain/entities/index.ts`                                           | Tambah export                                                                                          |
| `packages/backend/src/domain/interfaces/ISavingTransactionRepository.ts`                  | **BARU** — repo interface                                                                              |
| `packages/backend/src/domain/interfaces/index.ts`                                         | Tambah export                                                                                          |
| `packages/backend/src/infrastructure/repositories/InMemorySavingTransactionRepository.ts` | **BARU**                                                                                               |
| `packages/backend/src/infrastructure/repositories/PrismaSavingTransactionRepository.ts`   | **BARU**                                                                                               |
| `packages/backend/src/infrastructure/repositories/index.ts`                               | Tambah export                                                                                          |
| `packages/backend/src/application/services/SavingService.ts`                              | **BARU** — business logic                                                                              |
| `packages/backend/src/application/services/index.ts`                                      | Tambah export                                                                                          |
| `packages/backend/src/application/services/PaymentService.ts`                             | Integrasi auto-credit & auto-reversal saving                                                           |
| `packages/backend/src/application/dtos/index.ts`                                          | Tambah DTO saving                                                                                      |
| `packages/backend/src/presentation/controllers/SavingController.ts`                       | **BARU**                                                                                               |
| `packages/backend/src/presentation/routes/index.ts`                                       | Tambah saving routes                                                                                   |
| `packages/backend/src/index.ts`                                                           | Wire repo & service baru                                                                               |
| `packages/backend/src/__tests__/SavingService.test.ts`                                    | **BARU** — test suite                                                                                  |
| `packages/frontend/src/types/index.ts`                                                    | Tambah types saving                                                                                    |
| `packages/frontend/src/lib/api.ts`                                                        | Tambah API methods saving                                                                              |
| `packages/frontend/src/hooks/useApi.ts`                                                   | Tambah SWR hooks saving                                                                                |
| `packages/frontend/src/lib/schemas.ts`                                                    | Tambah Zod schemas saving                                                                              |
| `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx`                           | Tambah section Saving di detail kontrak                                                                |

---

## LANGKAH 1: DATABASE SCHEMA

### 1A. Tambah Enum di Prisma Schema

**File**: `packages/backend/prisma/schema.prisma`
**Lokasi**: setelah enum `PaymentDayStatus` (line 83)

```prisma
enum SavingTransactionType {
  CREDIT
  DEBIT_SERVICE
  DEBIT_TRANSFER
  DEBIT_CLAIM
  REVERSAL
}
```

**Penjelasan setiap tipe:**

- `CREDIT` — Saving masuk dari pembayaran harian. Otomatis oleh sistem saat invoice DAILY_BILLING/MANUAL_PAYMENT di-PAID.
- `DEBIT_SERVICE` — Penggunaan saving untuk service motor (servis, spare part, dll.). Dilakukan manual oleh admin.
- `DEBIT_TRANSFER` — Penggunaan saving untuk biaya balik nama STNK/BPKB. Dilakukan manual oleh admin. Hanya boleh saat kontrak COMPLETED.
- `DEBIT_CLAIM` — Customer claim/tarik tunai sisa saving. Dilakukan manual oleh admin. Hanya boleh saat kontrak COMPLETED (BUKAN CANCELLED/REPOSSESSED).
- `REVERSAL` — Pembalikan transaksi CREDIT. Otomatis oleh sistem saat payment di-revert dari PAID → PENDING.

> PENTING: Jangan reuse enum existing. `SavingTransactionType` adalah konteks yang berbeda dari `PaymentStatus`, `InvoiceType`, dll.

### 1B. Tambah Model SavingTransaction

**File**: `packages/backend/prisma/schema.prisma`
**Lokasi**: setelah model `PaymentDay` (akhir file)

```prisma
model SavingTransaction {
  id            String                 @id @default(uuid())
  contractId    String                 @map("contract_id")
  type          SavingTransactionType
  amount        Int                    // Selalu positif. Arah ditentukan oleh type (CREDIT=masuk, DEBIT_*=keluar, REVERSAL=keluar)
  balanceBefore Int                    @map("balance_before")
  balanceAfter  Int                    @map("balance_after")

  // Referensi sumber transaksi
  paymentId     String?                @map("payment_id")     // FK ke Invoice (untuk CREDIT / REVERSAL)
  daysCount     Int?                   @map("days_count")     // Jumlah hari yang menghasilkan saving (untuk CREDIT)

  // Detail transaksi (untuk DEBIT)
  description   String?                // "Service rem + ganti kampas", "Biaya balik nama STNK", dll.
  photo         String?                // URL foto bukti (nota servis, kwitansi, dll.)

  // Admin & audit
  createdBy     String                 @map("created_by")     // Admin user ID yang melakukan transaksi
  notes         String?                // Catatan tambahan admin

  createdAt     DateTime               @default(now()) @map("created_at")

  // Relations
  contract      Contract               @relation(fields: [contractId], references: [id])
  payment       Invoice?               @relation(fields: [paymentId], references: [id])

  @@index([contractId])
  @@index([paymentId])
  @@index([type])
  @@map("saving_transactions")
}
```

**Penjelasan field-by-field:**

- `id`: UUID primary key, konsisten dengan semua model lain di project.
- `contractId`: FK ke Contract. Saving selalu per kontrak.
- `type`: Enum `SavingTransactionType`. Menentukan arah transaksi.
- `amount`: **Selalu positif**. Arah (masuk/keluar) ditentukan oleh `type`:
  - `CREDIT` → saldo bertambah (`balanceAfter = balanceBefore + amount`)
  - `DEBIT_*` → saldo berkurang (`balanceAfter = balanceBefore - amount`)
  - `REVERSAL` → saldo berkurang (`balanceAfter = balanceBefore - amount`)
- `balanceBefore`: Snapshot saldo sebelum transaksi ini. Untuk audit trail & debugging.
- `balanceAfter`: Snapshot saldo setelah transaksi ini. Harus konsisten.
- `paymentId`: FK ke Invoice. Terisi untuk CREDIT (invoice yang di-PAID) dan REVERSAL (invoice yang di-revert). Null untuk DEBIT\_\*.
- `daysCount`: Jumlah hari kerja yang menghasilkan saving. Hanya untuk CREDIT. `amount = daysCount × SAVING_PER_DAY`.
- `description`: Deskripsi transaksi. Wajib diisi untuk DEBIT_SERVICE dan DEBIT_TRANSFER. Contoh: "Service rem depan + ganti kampas rem", "Biaya balik nama STNK".
- `photo`: URL foto bukti. Opsional. Contoh: foto nota servis, kwitansi balik nama.
- `createdBy`: Admin user ID. Setiap transaksi saving pasti dilakukan oleh admin (termasuk CREDIT/REVERSAL otomatis — gunakan admin yang men-trigger pembayaran).
- `notes`: Catatan tambahan admin. Opsional.
- `createdAt`: Timestamp transaksi. Tidak ada `updatedAt` karena SavingTransaction **immutable** — sekali dibuat tidak bisa diubah. Jika perlu koreksi, buat transaksi reversal baru.

### 1C. Update Model Contract — Tambah Field savingBalance

**File**: `packages/backend/prisma/schema.prisma`
**Lokasi**: Di model `Contract`, setelah field `gracePeriodDays` (line 171), sebelum `repossessedAt`

```prisma
  savingBalance       Int       @default(0) @map("saving_balance")
```

Dan tambah relasi di bagian relations (setelah `paymentDays PaymentDay[]`):

```prisma
  savingTransactions SavingTransaction[]
```

### 1D. Update Model Invoice — Tambah Relasi

**File**: `packages/backend/prisma/schema.prisma`
**Lokasi**: Di model `Invoice`, setelah `paymentDays PaymentDay[]` (line 223)

```prisma
  savingTransactions SavingTransaction[]
```

### 1E. Generate Prisma Client

```bash
cd packages/backend && npx prisma generate
```

> JANGAN `db push` — itu dilakukan saat deploy atau manual. Cukup `generate` untuk update Prisma Client TypeScript types.

---

## LANGKAH 2: DOMAIN LAYER

### 2A. Tambah Enum & Konstanta

**File**: `packages/backend/src/domain/enums/index.ts`
**Lokasi**: setelah enum `PaymentDayStatus` (line 95, sebelum `VALID_STATUS_TRANSITIONS`)

```typescript
export enum SavingTransactionType {
  CREDIT = 'CREDIT',
  DEBIT_SERVICE = 'DEBIT_SERVICE',
  DEBIT_TRANSFER = 'DEBIT_TRANSFER',
  DEBIT_CLAIM = 'DEBIT_CLAIM',
  REVERSAL = 'REVERSAL',
}

export const SAVING_PER_DAY = 5000; // Rp 5.000 per hari kerja
```

### 2B. Buat Entity

**File BARU**: `packages/backend/src/domain/entities/SavingTransaction.ts`

```typescript
import { SavingTransactionType } from '../enums';

export interface SavingTransaction {
  id: string;
  contractId: string;
  type: SavingTransactionType;
  amount: number; // Selalu positif
  balanceBefore: number;
  balanceAfter: number;
  paymentId: string | null;
  daysCount: number | null;
  description: string | null;
  photo: string | null;
  createdBy: string;
  notes: string | null;
  createdAt: Date;
}
```

### 2C. Update Barrel Export Entities

**File**: `packages/backend/src/domain/entities/index.ts`

Tambah di akhir file (setelah `export type { PaymentDay } from './PaymentDay';`):

```typescript
export type { SavingTransaction } from './SavingTransaction';
```

### 2D. Buat Repository Interface

**File BARU**: `packages/backend/src/domain/interfaces/ISavingTransactionRepository.ts`

```typescript
import { SavingTransaction } from '../entities/SavingTransaction';
import { SavingTransactionType } from '../enums';

export interface ISavingTransactionRepository {
  findById(id: string): Promise<SavingTransaction | null>;
  findByContractId(contractId: string): Promise<SavingTransaction[]>; // ordered by createdAt DESC
  findByPaymentId(paymentId: string): Promise<SavingTransaction[]>;
  findByContractAndType(
    contractId: string,
    type: SavingTransactionType,
  ): Promise<SavingTransaction[]>;
  create(tx: SavingTransaction): Promise<SavingTransaction>;
  count(contractId: string): Promise<number>;
}
```

**Penjelasan method-by-method:**

- `findById`: Cari transaksi by ID. Untuk detail/audit.
- `findByContractId`: Semua transaksi saving untuk kontrak tertentu. **Ordered by createdAt DESC** (terbaru di atas). Digunakan untuk riwayat transaksi di frontend.
- `findByPaymentId`: Cari transaksi CREDIT yang linked ke invoice tertentu. Digunakan saat reversal — cari credit yang perlu di-reverse.
- `findByContractAndType`: Filter transaksi by type. Contoh: semua CREDIT untuk kontrak X.
- `create`: Buat transaksi baru. **SavingTransaction immutable** — tidak ada method update.
- `count`: Hitung total transaksi untuk kontrak. Untuk info/statistik.

> PENTING: Tidak ada method `update` atau `delete`. SavingTransaction bersifat **immutable** (append-only log). Jika perlu koreksi, buat transaksi REVERSAL baru.

### 2E. Update Barrel Export Interfaces

**File**: `packages/backend/src/domain/interfaces/index.ts`

Tambah di akhir file (setelah `export type { IPaymentDayRepository } from './IPaymentDayRepository';`):

```typescript
export type { ISavingTransactionRepository } from './ISavingTransactionRepository';
```

---

## LANGKAH 3: INFRASTRUCTURE LAYER — REPOSITORIES

### 3A. InMemorySavingTransactionRepository

**File BARU**: `packages/backend/src/infrastructure/repositories/InMemorySavingTransactionRepository.ts`

Implementasikan semua methods dari `ISavingTransactionRepository` menggunakan `Map<string, SavingTransaction>`.

**Pattern yang WAJIB diikuti** (referensi: `InMemoryPaymentDayRepository.ts`, `InMemoryInvoiceRepository.ts`):

- Private `private data = new Map<string, SavingTransaction>();`
- Semua method async (return Promise)
- `findByContractId`: filter by contractId, **sort by createdAt DESC**
- `findByPaymentId`: filter by paymentId (could be null — skip nulls)
- `findByContractAndType`: filter by contractId AND type
- `create`: set ke Map, return copy (spread operator)
- `count`: filter by contractId, return length

```typescript
import { ISavingTransactionRepository } from '../../domain/interfaces/ISavingTransactionRepository';
import { SavingTransaction } from '../../domain/entities/SavingTransaction';
import { SavingTransactionType } from '../../domain/enums';

export class InMemorySavingTransactionRepository implements ISavingTransactionRepository {
  private data = new Map<string, SavingTransaction>();

  async findById(id: string): Promise<SavingTransaction | null> {
    return this.data.get(id) ? { ...this.data.get(id)! } : null;
  }

  async findByContractId(contractId: string): Promise<SavingTransaction[]> {
    return Array.from(this.data.values())
      .filter((tx) => tx.contractId === contractId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((tx) => ({ ...tx }));
  }

  async findByPaymentId(paymentId: string): Promise<SavingTransaction[]> {
    return Array.from(this.data.values())
      .filter((tx) => tx.paymentId === paymentId)
      .map((tx) => ({ ...tx }));
  }

  async findByContractAndType(
    contractId: string,
    type: SavingTransactionType,
  ): Promise<SavingTransaction[]> {
    return Array.from(this.data.values())
      .filter((tx) => tx.contractId === contractId && tx.type === type)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((tx) => ({ ...tx }));
  }

  async create(tx: SavingTransaction): Promise<SavingTransaction> {
    this.data.set(tx.id, { ...tx });
    return { ...tx };
  }

  async count(contractId: string): Promise<number> {
    return Array.from(this.data.values()).filter((tx) => tx.contractId === contractId).length;
  }
}
```

### 3B. PrismaSavingTransactionRepository

**File BARU**: `packages/backend/src/infrastructure/repositories/PrismaSavingTransactionRepository.ts`

**Pattern yang WAJIB diikuti** (referensi: `PrismaPaymentDayRepository.ts`):

- Constructor menerima `PrismaClient`
- Private `toEntity(raw: any): SavingTransaction` method — cast Prisma types ke domain entity, termasuk enum casting
- Semua queries menggunakan `this.prisma.savingTransaction.*`

```typescript
import { PrismaClient } from '@prisma/client';
import { ISavingTransactionRepository } from '../../domain/interfaces/ISavingTransactionRepository';
import { SavingTransaction } from '../../domain/entities/SavingTransaction';
import { SavingTransactionType } from '../../domain/enums';

export class PrismaSavingTransactionRepository implements ISavingTransactionRepository {
  constructor(private prisma: PrismaClient) {}

  private toEntity(raw: any): SavingTransaction {
    return {
      ...raw,
      type: raw.type as SavingTransactionType,
    };
  }

  async findById(id: string): Promise<SavingTransaction | null> {
    const raw = await this.prisma.savingTransaction.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async findByContractId(contractId: string): Promise<SavingTransaction[]> {
    const raws = await this.prisma.savingTransaction.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
    return raws.map((r) => this.toEntity(r));
  }

  async findByPaymentId(paymentId: string): Promise<SavingTransaction[]> {
    const raws = await this.prisma.savingTransaction.findMany({
      where: { paymentId },
    });
    return raws.map((r) => this.toEntity(r));
  }

  async findByContractAndType(
    contractId: string,
    type: SavingTransactionType,
  ): Promise<SavingTransaction[]> {
    const raws = await this.prisma.savingTransaction.findMany({
      where: { contractId, type: type as any },
      orderBy: { createdAt: 'desc' },
    });
    return raws.map((r) => this.toEntity(r));
  }

  async create(tx: SavingTransaction): Promise<SavingTransaction> {
    const raw = await this.prisma.savingTransaction.create({
      data: {
        id: tx.id,
        contractId: tx.contractId,
        type: tx.type as any,
        amount: tx.amount,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
        paymentId: tx.paymentId,
        daysCount: tx.daysCount,
        description: tx.description,
        photo: tx.photo,
        createdBy: tx.createdBy,
        notes: tx.notes,
      },
    });
    return this.toEntity(raw);
  }

  async count(contractId: string): Promise<number> {
    return this.prisma.savingTransaction.count({ where: { contractId } });
  }
}
```

### 3C. Update Barrel Export

**File**: `packages/backend/src/infrastructure/repositories/index.ts`

Tambah di akhir file:

```typescript
export { InMemorySavingTransactionRepository } from './InMemorySavingTransactionRepository';
export { PrismaSavingTransactionRepository } from './PrismaSavingTransactionRepository';
```

---

## LANGKAH 4: APPLICATION LAYER — SERVICE & DTOs

### 4A. DTOs Baru

**File**: `packages/backend/src/application/dtos/index.ts`
**Lokasi**: di akhir file (setelah `UpdateSettingDto`)

```typescript
// Saving DTOs
export const DebitSavingDto = z.object({
  amount: z.number().int().positive('Nominal harus lebih dari 0'),
  description: z.string().min(1, 'Deskripsi wajib diisi'),
  photo: z.string().optional().nullable().default(null),
  notes: z.string().optional().nullable().default(null),
});
export type DebitSavingDto = z.infer<typeof DebitSavingDto>;

export const ClaimSavingDto = z.object({
  amount: z.number().int().positive('Nominal harus lebih dari 0').optional(), // Jika tidak diisi = claim semua sisa
  notes: z.string().optional().nullable().default(null),
});
export type ClaimSavingDto = z.infer<typeof ClaimSavingDto>;
```

**Tambah import** di bagian atas file jika belum ada:

```typescript
import { SavingTransactionType } from '../../domain/enums';
```

### 4B. SavingService — Business Logic

**File BARU**: `packages/backend/src/application/services/SavingService.ts`

**Constructor dependencies** (inject via constructor):

```typescript
import { ISavingTransactionRepository } from '../../domain/interfaces/ISavingTransactionRepository';
import { IContractRepository } from '../../domain/interfaces/IContractRepository';
import { IInvoiceRepository } from '../../domain/interfaces/IInvoiceRepository';
import { IAuditLogRepository } from '../../domain/interfaces/IAuditLogRepository';
import { SavingTransaction } from '../../domain/entities/SavingTransaction';
import { Contract } from '../../domain/entities/Contract';
import { SavingTransactionType, SAVING_PER_DAY, AuditAction, ContractStatus } from '../../domain/enums';
import { v4 as uuidv4 } from 'uuid';

export class SavingService {
  constructor(
    private savingTxRepo: ISavingTransactionRepository,
    private contractRepo: IContractRepository,
    private invoiceRepo: IInvoiceRepository,
    private auditRepo: IAuditLogRepository,
  ) {}
```

**Methods yang WAJIB diimplementasikan:**

#### Method 1: `creditFromPayment(paymentId, adminId)`

Dipanggil **otomatis** dari PaymentService setelah invoice DAILY_BILLING / MANUAL_PAYMENT di-mark PAID.

```typescript
/**
 * Auto-credit saving saat invoice harian dibayar.
 * amount = SAVING_PER_DAY × daysCount
 *
 * PENTING:
 * - Hanya untuk invoice type DAILY_BILLING atau MANUAL_PAYMENT
 * - Hanya untuk invoice yang BUKAN holiday (isHoliday === false)
 * - daysCount diambil dari invoice.daysCount (jumlah working days yang dibayar)
 */
async creditFromPayment(paymentId: string, adminId: string): Promise<SavingTransaction> {
  const invoice = await this.invoiceRepo.findById(paymentId);
  if (!invoice) throw new Error('Invoice not found');

  const contract = await this.contractRepo.findById(invoice.contractId);
  if (!contract) throw new Error('Contract not found');

  const daysCount = invoice.daysCount || 0;
  if (daysCount <= 0) throw new Error('Invalid daysCount for saving credit');

  const savingAmount = SAVING_PER_DAY * daysCount;
  const balanceBefore = contract.savingBalance;
  const balanceAfter = balanceBefore + savingAmount;

  const tx: SavingTransaction = {
    id: uuidv4(),
    contractId: contract.id,
    type: SavingTransactionType.CREDIT,
    amount: savingAmount,
    balanceBefore,
    balanceAfter,
    paymentId: invoice.id,
    daysCount,
    description: null,
    photo: null,
    createdBy: adminId,
    notes: null,
    createdAt: new Date(),
  };

  const created = await this.savingTxRepo.create(tx);

  // Update denormalized balance
  await this.contractRepo.update(contract.id, { savingBalance: balanceAfter });

  // Audit log
  await this.auditRepo.create({
    id: uuidv4(),
    userId: adminId,
    action: AuditAction.CREATE,
    module: 'saving',
    entityId: created.id,
    description: `Saving credit Rp ${savingAmount.toLocaleString('id-ID')} from ${invoice.invoiceNumber} (${daysCount} days × Rp ${SAVING_PER_DAY.toLocaleString('id-ID')})`,
    metadata: {
      type: 'CREDIT',
      amount: savingAmount,
      daysCount,
      paymentId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      balanceBefore,
      balanceAfter,
    },
    ipAddress: '',
    createdAt: new Date(),
  });

  return created;
}
```

#### Method 2: `reverseCreditFromPayment(paymentId, adminId)`

Dipanggil **otomatis** dari PaymentService saat invoice di-revert dari PAID → PENDING.

```typescript
/**
 * Auto-reverse saving credit saat payment di-revert.
 * Cari SavingTransaction CREDIT dengan paymentId ini, buat REVERSAL.
 *
 * Return null jika tidak ada credit yang perlu di-reverse (misal invoice bukan tipe harian).
 */
async reverseCreditFromPayment(paymentId: string, adminId: string): Promise<SavingTransaction | null> {
  const creditTxs = await this.savingTxRepo.findByPaymentId(paymentId);
  const creditTx = creditTxs.find(tx => tx.type === SavingTransactionType.CREDIT);

  if (!creditTx) return null; // Tidak ada credit untuk invoice ini

  const contract = await this.contractRepo.findById(creditTx.contractId);
  if (!contract) throw new Error('Contract not found');

  const balanceBefore = contract.savingBalance;
  const balanceAfter = balanceBefore - creditTx.amount;

  // Guard: saldo tidak boleh negatif
  if (balanceAfter < 0) {
    throw new Error(`Insufficient saving balance for reversal. Current: Rp ${balanceBefore.toLocaleString('id-ID')}, reversal: Rp ${creditTx.amount.toLocaleString('id-ID')}`);
  }

  const reversalTx: SavingTransaction = {
    id: uuidv4(),
    contractId: creditTx.contractId,
    type: SavingTransactionType.REVERSAL,
    amount: creditTx.amount,
    balanceBefore,
    balanceAfter,
    paymentId,
    daysCount: creditTx.daysCount,
    description: `Reversal of CREDIT from payment revert`,
    photo: null,
    createdBy: adminId,
    notes: null,
    createdAt: new Date(),
  };

  const created = await this.savingTxRepo.create(reversalTx);

  // Update denormalized balance
  await this.contractRepo.update(creditTx.contractId, { savingBalance: balanceAfter });

  // Audit log
  await this.auditRepo.create({
    id: uuidv4(),
    userId: adminId,
    action: AuditAction.UPDATE,
    module: 'saving',
    entityId: created.id,
    description: `Saving reversal Rp ${creditTx.amount.toLocaleString('id-ID')} (payment revert)`,
    metadata: {
      type: 'REVERSAL',
      amount: creditTx.amount,
      originalCreditId: creditTx.id,
      paymentId,
      balanceBefore,
      balanceAfter,
    },
    ipAddress: '',
    createdAt: new Date(),
  });

  return created;
}
```

#### Method 3: `debitForService(contractId, dto, adminId)`

Dipanggil **manual** oleh admin via API saat customer service motor.

```typescript
/**
 * Debit saving untuk biaya service motor.
 * Validasi: contract exists, status ACTIVE/OVERDUE/COMPLETED, amount <= savingBalance.
 */
async debitForService(contractId: string, dto: DebitSavingDto, adminId: string): Promise<SavingTransaction> {
  const contract = await this.contractRepo.findById(contractId);
  if (!contract) throw new Error('Contract not found');

  const allowedStatuses = [ContractStatus.ACTIVE, ContractStatus.OVERDUE, ContractStatus.COMPLETED];
  if (!allowedStatuses.includes(contract.status)) {
    throw new Error(`Saving tidak dapat digunakan pada kontrak berstatus ${contract.status}`);
  }

  if (dto.amount > contract.savingBalance) {
    throw new Error(`Saldo saving tidak cukup. Saldo: Rp ${contract.savingBalance.toLocaleString('id-ID')}, dibutuhkan: Rp ${dto.amount.toLocaleString('id-ID')}`);
  }

  const balanceBefore = contract.savingBalance;
  const balanceAfter = balanceBefore - dto.amount;

  const tx: SavingTransaction = {
    id: uuidv4(),
    contractId,
    type: SavingTransactionType.DEBIT_SERVICE,
    amount: dto.amount,
    balanceBefore,
    balanceAfter,
    paymentId: null,
    daysCount: null,
    description: dto.description,
    photo: dto.photo || null,
    createdBy: adminId,
    notes: dto.notes || null,
    createdAt: new Date(),
  };

  const created = await this.savingTxRepo.create(tx);
  await this.contractRepo.update(contractId, { savingBalance: balanceAfter });

  await this.auditRepo.create({
    id: uuidv4(),
    userId: adminId,
    action: AuditAction.UPDATE,
    module: 'saving',
    entityId: created.id,
    description: `Saving debit for service: Rp ${dto.amount.toLocaleString('id-ID')} — ${dto.description}`,
    metadata: {
      type: 'DEBIT_SERVICE',
      amount: dto.amount,
      description: dto.description,
      balanceBefore,
      balanceAfter,
    },
    ipAddress: '',
    createdAt: new Date(),
  });

  return created;
}
```

#### Method 4: `debitForTransfer(contractId, dto, adminId)`

Sama pattern dengan `debitForService` tapi dengan validasi status lebih ketat.

```typescript
/**
 * Debit saving untuk biaya balik nama STNK & BPKB.
 * Validasi: contract exists, status HARUS COMPLETED, amount <= savingBalance.
 */
async debitForTransfer(contractId: string, dto: DebitSavingDto, adminId: string): Promise<SavingTransaction> {
  const contract = await this.contractRepo.findById(contractId);
  if (!contract) throw new Error('Contract not found');

  if (contract.status !== ContractStatus.COMPLETED) {
    throw new Error('Saving untuk balik nama hanya tersedia pada kontrak yang sudah COMPLETED');
  }

  if (dto.amount > contract.savingBalance) {
    throw new Error(`Saldo saving tidak cukup. Saldo: Rp ${contract.savingBalance.toLocaleString('id-ID')}, dibutuhkan: Rp ${dto.amount.toLocaleString('id-ID')}`);
  }

  const balanceBefore = contract.savingBalance;
  const balanceAfter = balanceBefore - dto.amount;

  const tx: SavingTransaction = {
    id: uuidv4(),
    contractId,
    type: SavingTransactionType.DEBIT_TRANSFER,
    amount: dto.amount,
    balanceBefore,
    balanceAfter,
    paymentId: null,
    daysCount: null,
    description: dto.description,
    photo: dto.photo || null,
    createdBy: adminId,
    notes: dto.notes || null,
    createdAt: new Date(),
  };

  const created = await this.savingTxRepo.create(tx);
  await this.contractRepo.update(contractId, { savingBalance: balanceAfter });

  await this.auditRepo.create({
    id: uuidv4(),
    userId: adminId,
    action: AuditAction.UPDATE,
    module: 'saving',
    entityId: created.id,
    description: `Saving debit for transfer: Rp ${dto.amount.toLocaleString('id-ID')} — ${dto.description}`,
    metadata: {
      type: 'DEBIT_TRANSFER',
      amount: dto.amount,
      description: dto.description,
      balanceBefore,
      balanceAfter,
    },
    ipAddress: '',
    createdAt: new Date(),
  });

  return created;
}
```

#### Method 5: `claimSaving(contractId, dto, adminId)`

```typescript
/**
 * Claim sisa saving oleh customer.
 * Validasi: contract COMPLETED (bukan CANCELLED/REPOSSESSED), savingBalance > 0.
 * Jika dto.amount tidak diisi → claim semua sisa.
 */
async claimSaving(contractId: string, dto: ClaimSavingDto, adminId: string): Promise<SavingTransaction> {
  const contract = await this.contractRepo.findById(contractId);
  if (!contract) throw new Error('Contract not found');

  if (contract.status !== ContractStatus.COMPLETED) {
    if (contract.status === ContractStatus.CANCELLED || contract.status === ContractStatus.REPOSSESSED) {
      throw new Error('Saving tidak dapat di-claim pada kontrak yang CANCELLED atau REPOSSESSED');
    }
    throw new Error('Saving hanya dapat di-claim pada kontrak yang sudah COMPLETED');
  }

  if (contract.savingBalance <= 0) {
    throw new Error('Saldo saving sudah habis');
  }

  const claimAmount = dto.amount || contract.savingBalance; // Default: claim semua
  if (claimAmount > contract.savingBalance) {
    throw new Error(`Saldo saving tidak cukup. Saldo: Rp ${contract.savingBalance.toLocaleString('id-ID')}, diminta: Rp ${claimAmount.toLocaleString('id-ID')}`);
  }

  const balanceBefore = contract.savingBalance;
  const balanceAfter = balanceBefore - claimAmount;

  const tx: SavingTransaction = {
    id: uuidv4(),
    contractId,
    type: SavingTransactionType.DEBIT_CLAIM,
    amount: claimAmount,
    balanceBefore,
    balanceAfter,
    paymentId: null,
    daysCount: null,
    description: `Claim sisa saving oleh customer`,
    photo: null,
    createdBy: adminId,
    notes: dto.notes || null,
    createdAt: new Date(),
  };

  const created = await this.savingTxRepo.create(tx);
  await this.contractRepo.update(contractId, { savingBalance: balanceAfter });

  await this.auditRepo.create({
    id: uuidv4(),
    userId: adminId,
    action: AuditAction.UPDATE,
    module: 'saving',
    entityId: created.id,
    description: `Saving claim: Rp ${claimAmount.toLocaleString('id-ID')}`,
    metadata: {
      type: 'DEBIT_CLAIM',
      amount: claimAmount,
      balanceBefore,
      balanceAfter,
    },
    ipAddress: '',
    createdAt: new Date(),
  });

  return created;
}
```

#### Method 6: `getBalance(contractId)`

```typescript
/**
 * Quick read saldo saving dari denormalized field.
 */
async getBalance(contractId: string): Promise<number> {
  const contract = await this.contractRepo.findById(contractId);
  if (!contract) throw new Error('Contract not found');
  return contract.savingBalance;
}
```

#### Method 7: `getTransactionHistory(contractId)`

```typescript
/**
 * Ambil semua riwayat transaksi saving, ordered by createdAt DESC.
 */
async getTransactionHistory(contractId: string): Promise<SavingTransaction[]> {
  return this.savingTxRepo.findByContractId(contractId);
}
```

#### Method 8: `recalculateBalance(contractId, adminId)`

```typescript
/**
 * Utility: recalculate savingBalance dari seluruh SavingTransaction.
 * Gunakan jika ada suspected discrepancy antara denormalized balance dan actual transactions.
 */
async recalculateBalance(contractId: string, adminId: string): Promise<number> {
  const contract = await this.contractRepo.findById(contractId);
  if (!contract) throw new Error('Contract not found');

  const allTxs = await this.savingTxRepo.findByContractId(contractId);

  let calculatedBalance = 0;
  for (const tx of allTxs) {
    if (tx.type === SavingTransactionType.CREDIT) {
      calculatedBalance += tx.amount;
    } else {
      // DEBIT_SERVICE, DEBIT_TRANSFER, DEBIT_CLAIM, REVERSAL → semua mengurangi
      calculatedBalance -= tx.amount;
    }
  }

  // Ensure non-negative
  calculatedBalance = Math.max(0, calculatedBalance);

  if (calculatedBalance !== contract.savingBalance) {
    await this.contractRepo.update(contractId, { savingBalance: calculatedBalance });

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'saving',
      entityId: contractId,
      description: `Saving balance recalculated: Rp ${contract.savingBalance.toLocaleString('id-ID')} → Rp ${calculatedBalance.toLocaleString('id-ID')}`,
      metadata: {
        oldBalance: contract.savingBalance,
        newBalance: calculatedBalance,
        transactionCount: allTxs.length,
      },
      ipAddress: '',
      createdAt: new Date(),
    });
  }

  return calculatedBalance;
}
```

### 4C. Update Barrel Export Services

**File**: `packages/backend/src/application/services/index.ts`

Tambah di akhir file:

```typescript
export { SavingService } from './SavingService';
```

---

## LANGKAH 5: INTEGRASI DENGAN PAYMENTSERVICE

**File**: `packages/backend/src/application/services/PaymentService.ts`

### 5A. Tambah SavingService sebagai Dependency

**PENTING — Jangan inject SavingService via constructor.** Ini akan membuat circular dependency karena SavingService juga depend pada IInvoiceRepository dan IContractRepository.

Gunakan **setter injection** atau **method parameter** sebagai gantinya:

```typescript
// Di class PaymentService, tambah property:
private savingService?: SavingService;

// Tambah setter:
setSavingService(savingService: SavingService): void {
  this.savingService = savingService;
}
```

### 5B. Update `payPayment()` — Auto-credit Saving

**Lokasi**: `PaymentService.ts`, method `payPayment()` (sekitar line 504-563)

Setelah `syncContractFromPaymentDays` berhasil (line 538), dan sebelum audit log, tambahkan:

```typescript
// Auto-credit saving
if (this.savingService && !payment.isHoliday && payment.daysCount && payment.daysCount > 0) {
  try {
    await this.savingService.creditFromPayment(payment.id, adminId);
  } catch (error) {
    console.error('Failed to credit saving:', error);
    // Tidak throw — saving credit failure TIDAK boleh menggagalkan pembayaran
  }
}
```

**PENTING**: Saving credit di-wrap dalam try-catch. Jika saving credit gagal, pembayaran tetap berhasil. Ini memastikan fitur saving tidak mengganggu flow pembayaran utama.

### 5C. Update `revertPaymentStatus()` — Auto-reverse Saving

**Lokasi**: `PaymentService.ts`, method `revertPaymentStatus()` (cari method yang handle revert dari PAID ke PENDING)

Setelah PaymentDay records dikembalikan ke UNPAID dan sebelum audit log, tambahkan:

```typescript
// Auto-reverse saving
if (this.savingService) {
  try {
    await this.savingService.reverseCreditFromPayment(payment.id, adminId);
  } catch (error) {
    console.error('Failed to reverse saving:', error);
    // Tidak throw — saving reversal failure TIDAK boleh menggagalkan revert
  }
}
```

### 5D. Juga Update `markPaid()` jika Ada

Jika ada method `markPaid()` terpisah yang juga memproses pembayaran (selain `payPayment()`), tambahkan auto-credit saving yang sama di sana.

Cek apakah di PaymentService ada method lain yang men-set invoice status ke PAID — jika ada, SEMUA harus auto-credit saving.

---

## LANGKAH 6: WIRING — ENTRY POINT

**File**: `packages/backend/src/index.ts`

### 6A. Import

Tambah import di bagian atas (setelah existing imports):

```typescript
import {
  InMemorySavingTransactionRepository,
  PrismaSavingTransactionRepository,
} from './infrastructure/repositories';
import { ISavingTransactionRepository } from './domain/interfaces/ISavingTransactionRepository';
import { SavingService } from './application/services/SavingService';
import { SavingController } from './presentation/controllers/SavingController';
```

### 6B. Declare & Initialize Repository

Di bagian repository declaration (line 61-67), tambah:

```typescript
let savingTxRepo: ISavingTransactionRepository;
```

Di blok `if (usePrisma)` (line 69-80), tambah:

```typescript
savingTxRepo = new PrismaSavingTransactionRepository(prisma);
```

Di blok `else` InMemory (line 81-89), tambah:

```typescript
savingTxRepo = new InMemorySavingTransactionRepository();
```

### 6C. Initialize Service

Setelah inisialisasi `paymentService` (line 97), tambah:

```typescript
const savingService = new SavingService(savingTxRepo, contractRepo, invoiceRepo, auditRepo);

// Wire saving service ke payment service (setter injection)
paymentService.setSavingService(savingService);
```

### 6D. Initialize Controller

Setelah inisialisasi controllers existing (line 118-126), tambah:

```typescript
const savingController = new SavingController(savingService);
```

### 6E. Update Routes Interface & Wire

Update `createRoutes` call (line 132-142) untuk include `savingController`:

```typescript
const routes = createRoutes({
  authController,
  customerController,
  contractController,
  paymentController,
  dashboardController,
  reportController,
  auditController,
  settingController,
  savingController, // BARU
  authMiddleware,
});
```

---

## LANGKAH 7: PRESENTATION LAYER

### 7A. SavingController

**File BARU**: `packages/backend/src/presentation/controllers/SavingController.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { SavingService } from '../../application/services/SavingService';
import { DebitSavingDto, ClaimSavingDto } from '../../application/dtos';

export class SavingController {
  constructor(private savingService: SavingService) {}

  getByContractId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const [balance, transactions] = await Promise.all([
        this.savingService.getBalance(contractId),
        this.savingService.getTransactionHistory(contractId),
      ]);
      res.json({ balance, transactions });
    } catch (error) {
      next(error);
    }
  };

  getBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const balance = await this.savingService.getBalance(contractId);
      res.json({ balance });
    } catch (error) {
      next(error);
    }
  };

  debitForService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const adminId = (req as any).userId || 'system';
      const dto = DebitSavingDto.parse(req.body);
      const result = await this.savingService.debitForService(contractId, dto, adminId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  debitForTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const adminId = (req as any).userId || 'system';
      const dto = DebitSavingDto.parse(req.body);
      const result = await this.savingService.debitForTransfer(contractId, dto, adminId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  claimSaving = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const adminId = (req as any).userId || 'system';
      const dto = ClaimSavingDto.parse(req.body);
      const result = await this.savingService.claimSaving(contractId, dto, adminId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  recalculateBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const adminId = (req as any).userId || 'system';
      const balance = await this.savingService.recalculateBalance(contractId, adminId);
      res.json({ balance });
    } catch (error) {
      next(error);
    }
  };
}
```

### 7B. Update Routes

**File**: `packages/backend/src/presentation/routes/index.ts`

**Update interface** `RouteControllers` (line 11-21) — tambah:

```typescript
savingController: SavingController;
```

**Tambah import**:

```typescript
import { SavingController } from '../controllers/SavingController';
```

**Tambah routes** (setelah blok payments routes, sebelum reports routes, sekitar line 76):

```typescript
// Saving
router.get(
  '/savings/contract/:contractId',
  authMiddleware,
  controllers.savingController.getByContractId,
);
router.get(
  '/savings/contract/:contractId/balance',
  authMiddleware,
  controllers.savingController.getBalance,
);
router.post(
  '/savings/contract/:contractId/debit/service',
  authMiddleware,
  controllers.savingController.debitForService,
);
router.post(
  '/savings/contract/:contractId/debit/transfer',
  authMiddleware,
  controllers.savingController.debitForTransfer,
);
router.post(
  '/savings/contract/:contractId/claim',
  authMiddleware,
  controllers.savingController.claimSaving,
);
router.post(
  '/savings/contract/:contractId/recalculate',
  authMiddleware,
  controllers.savingController.recalculateBalance,
);
```

---

## LANGKAH 8: FRONTEND

### 8A. Types

**File**: `packages/frontend/src/types/index.ts`

Tambah enum dan interface baru (setelah `PaymentDayStatus` enum, line 51):

```typescript
export enum SavingTransactionType {
  CREDIT = 'CREDIT',
  DEBIT_SERVICE = 'DEBIT_SERVICE',
  DEBIT_TRANSFER = 'DEBIT_TRANSFER',
  DEBIT_CLAIM = 'DEBIT_CLAIM',
  REVERSAL = 'REVERSAL',
}

export interface SavingTransaction {
  id: string;
  contractId: string;
  type: SavingTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentId: string | null;
  daysCount: number | null;
  description: string | null;
  photo: string | null;
  createdBy: string;
  notes: string | null;
  createdAt: string;
}

export interface SavingData {
  balance: number;
  transactions: SavingTransaction[];
}
```

Tambah field di interface `Contract` (setelah `gracePeriodDays`, line 147):

```typescript
savingBalance: number;
```

### 8B. API Client

**File**: `packages/frontend/src/lib/api.ts`

Tambah methods baru di class `ApiClient` (setelah methods payment):

```typescript
// ============ Saving ============

async getSavingByContract(contractId: string) {
  return this.request<SavingData>(`/savings/contract/${contractId}`);
}

async getSavingBalance(contractId: string) {
  return this.request<{ balance: number }>(`/savings/contract/${contractId}/balance`);
}

async debitSavingForService(contractId: string, data: { amount: number; description: string; photo?: string; notes?: string }) {
  return this.request<SavingTransaction>(`/savings/contract/${contractId}/debit/service`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async debitSavingForTransfer(contractId: string, data: { amount: number; description: string; photo?: string; notes?: string }) {
  return this.request<SavingTransaction>(`/savings/contract/${contractId}/debit/transfer`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async claimSaving(contractId: string, data?: { amount?: number; notes?: string }) {
  return this.request<SavingTransaction>(`/savings/contract/${contractId}/claim`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}

async recalculateSavingBalance(contractId: string) {
  return this.request<{ balance: number }>(`/savings/contract/${contractId}/recalculate`, {
    method: 'POST',
  });
}
```

**Tambah import** di bagian atas file:

```typescript
import { SavingTransaction, SavingData } from '@/types';
```

### 8C. SWR Hooks

**File**: `packages/frontend/src/hooks/useApi.ts`

Tambah hooks baru (setelah hooks payment/calendar):

```typescript
// --- Saving ---
export function useSavingByContract(contractId: string | undefined) {
  return useSWR(
    contractId ? `/savings/contract/${contractId}` : null,
    () => api.getSavingByContract(contractId!),
    { dedupingInterval: TTL.SHORT },
  );
}

export function useSavingBalance(contractId: string | undefined) {
  return useSWR(
    contractId ? `/savings/contract/${contractId}/balance` : null,
    () => api.getSavingBalance(contractId!),
    { dedupingInterval: TTL.SHORT },
  );
}
```

### 8D. Zod Schemas

**File**: `packages/frontend/src/lib/schemas.ts`

Tambah di akhir file:

```typescript
// Saving Schemas
export const debitSavingSchema = z.object({
  amount: z.number().int().positive('Nominal harus lebih dari 0'),
  description: z.string().min(1, 'Deskripsi wajib diisi'),
  photo: z.string().optional(),
  notes: z.string().optional(),
});

export const claimSavingSchema = z.object({
  amount: z.number().int().positive('Nominal harus lebih dari 0').optional(),
  notes: z.string().optional(),
});
```

### 8E. Update Halaman Detail Kontrak

**File**: `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx`

**Tambahkan section baru "Saving"** di halaman detail kontrak. Letakkan setelah section Ownership Progress dan sebelum section Customer Info.

**Data hook yang digunakan:**

```typescript
const { data: savingData, mutate: mutateSaving } = useSavingByContract(id);
```

**Komponen yang harus ditampilkan:**

#### 1. Kartu Saldo Saving

- Tampilkan **saldo saving saat ini** dalam format currency (Rp X.XXX.XXX).
- Gunakan icon yang sesuai (piggy bank / wallet).
- **Badge status** berdasarkan kontrak:
  - COMPLETED + savingBalance > 0 → badge "Bisa Claim" (warna hijau)
  - CANCELLED / REPOSSESSED → badge "Tidak Dapat Di-claim" (warna merah/abu)
  - ACTIVE / OVERDUE → tidak perlu badge (saving masih berjalan, belum bisa claim)

#### 2. Tombol Aksi (di dalam atau di bawah kartu saldo)

- **"Gunakan untuk Servis"** — Tampil jika status ACTIVE/OVERDUE/COMPLETED dan savingBalance > 0. Buka dialog debit service.
- **"Gunakan untuk Balik Nama"** — Tampil HANYA jika status COMPLETED dan savingBalance > 0. Buka dialog debit transfer.
- **"Claim Saving"** — Tampil HANYA jika status COMPLETED dan savingBalance > 0. Buka dialog claim.
- Semua tombol **disabled jika savingBalance === 0**.

#### 3. Riwayat Transaksi Saving

- Tabel/list riwayat transaksi, kolom:
  - **Tanggal** — format `formatDateTime(tx.createdAt)`
  - **Tipe** — badge warna:
    - CREDIT → hijau, label "Masuk"
    - DEBIT_SERVICE → merah, label "Servis Motor"
    - DEBIT_TRANSFER → merah, label "Balik Nama"
    - DEBIT_CLAIM → oranye, label "Claim"
    - REVERSAL → kuning, label "Pembalikan"
  - **Deskripsi** — `tx.description` atau auto-generated text
  - **Nominal** — format: `+ Rp X.XXX` (hijau) untuk CREDIT, `- Rp X.XXX` (merah) untuk DEBIT/REVERSAL
  - **Saldo** — `tx.balanceAfter` (format currency)
- Sorted by createdAt DESC (terbaru di atas).
- Jika tidak ada transaksi, tampilkan empty state "Belum ada riwayat saving".

#### 4. Dialog Forms

**Dialog Debit (Servis Motor / Balik Nama):**

```
┌─────────────────────────────────────────┐
│  Gunakan Saving untuk Servis Motor      │
│                                         │
│  Saldo saat ini: Rp 500.000             │
│                                         │
│  Nominal *          [_____________]     │
│  Deskripsi *        [_____________]     │
│  Foto Bukti         [Upload / URL ]     │
│  Catatan            [_____________]     │
│                                         │
│  Preview:                               │
│  Saldo saat ini : Rp 500.000            │
│  Akan digunakan : Rp 300.000            │
│  Sisa setelah   : Rp 200.000            │
│                                         │
│           [Batal]    [Konfirmasi]        │
└─────────────────────────────────────────┘
```

- Validasi: nominal > 0, nominal <= saldo, deskripsi wajib diisi.
- Preview dinamis: saat nominal diisi, hitung sisa saldo.
- Setelah submit: `await api.debitSavingForService(contractId, data)`, lalu `mutateSaving()` + `invalidate('/contracts')`.
- Toast success: "Saving berhasil digunakan untuk servis".

**Dialog Claim:**

```
┌─────────────────────────────────────────┐
│  Claim Sisa Saving                      │
│                                         │
│  Saldo saat ini: Rp 200.000             │
│                                         │
│  Nominal Claim    [_____200.000_____]   │
│  (kosongkan untuk claim semua)          │
│  Catatan          [_____________]       │
│                                         │
│           [Batal]      [Claim]          │
└─────────────────────────────────────────┘
```

- Default nominal = saldo penuh (pre-filled, bisa diubah untuk partial claim).
- Validasi: nominal > 0, nominal <= saldo.
- Setelah submit: `await api.claimSaving(contractId, data)`, lalu refresh.
- Toast success: "Saving berhasil di-claim".

#### 5. Update Quick Stats

Di section Quick Stats yang sudah ada (kartu-kartu kecil: Progress, Hari Kerja, Hari Libur, Total Bayar), tambahkan kartu baru:

- **Label**: "Saving"
- **Value**: `Rp ${formatCurrency(contract.savingBalance)}`
- **Icon**: piggy bank atau wallet

**Bahasa UI — semua dalam Bahasa Indonesia:**

- "Saving" (tetap English — istilah umum)
- "Gunakan untuk Servis"
- "Gunakan untuk Balik Nama"
- "Claim Saving"
- "Riwayat Transaksi Saving"
- "Saldo saat ini"
- "Nominal"
- "Deskripsi"
- "Foto Bukti"
- "Catatan"
- "Konfirmasi"
- "Batal"

**SWR invalidation setelah mutasi:**

```typescript
const invalidate = useInvalidate();
// Setelah operasi saving:
invalidate('/savings', '/contracts');
```

---

## LANGKAH 9: TESTING

### 9A. Test Suite Baru: `SavingService.test.ts`

**File BARU**: `packages/backend/src/__tests__/SavingService.test.ts`

**Setup Pattern** (ikuti pattern dari test suites existing):

```typescript
import { SavingService } from '../application/services/SavingService';
import { InMemorySavingTransactionRepository } from '../infrastructure/repositories/InMemorySavingTransactionRepository';
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryInvoiceRepository } from '../infrastructure/repositories/InMemoryInvoiceRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import {
  SavingTransactionType,
  SAVING_PER_DAY,
  ContractStatus,
  PaymentStatus,
  InvoiceType,
} from '../domain/enums';
import { Contract } from '../domain/entities/Contract';
import { Invoice } from '../domain/entities/Invoice';
import { v4 as uuidv4 } from 'uuid';

describe('SavingService', () => {
  let savingService: SavingService;
  let savingTxRepo: InMemorySavingTransactionRepository;
  let contractRepo: InMemoryContractRepository;
  let invoiceRepo: InMemoryInvoiceRepository;
  let auditRepo: InMemoryAuditLogRepository;

  // Helper: buat contract aktif dengan savingBalance tertentu
  async function createContract(overrides?: Partial<Contract>): Promise<Contract> {
    const contract: Contract = {
      id: uuidv4(),
      contractNumber: 'RTO-260310-0001',
      customerId: uuidv4(),
      motorModel: 'ATHENA' as any,
      batteryType: 'REGULAR' as any,
      dailyRate: 58000,
      durationDays: 0,
      totalAmount: 0,
      startDate: new Date(),
      endDate: new Date(),
      status: ContractStatus.ACTIVE,
      notes: '',
      createdBy: 'admin',
      color: '',
      year: null,
      vinNumber: '',
      engineNumber: '',
      dpAmount: 530000,
      dpScheme: 'FULL' as any,
      dpPaidAmount: 530000,
      dpFullyPaid: true,
      unitReceivedDate: new Date(),
      billingStartDate: new Date(),
      bastPhoto: null,
      bastNotes: '',
      holidayScheme: 'NEW_CONTRACT' as any,
      ownershipTargetDays: 1278,
      totalDaysPaid: 0,
      workingDaysPaid: 0,
      holidayDaysPaid: 0,
      ownershipProgress: 0,
      gracePeriodDays: 7,
      savingBalance: 0,
      repossessedAt: null,
      completedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    return contractRepo.create(contract);
  }

  // Helper: buat invoice daily billing PAID
  async function createPaidDailyInvoice(contractId: string, customerId: string, daysCount: number, overrides?: Partial<Invoice>): Promise<Invoice> {
    const invoice: Invoice = {
      id: uuidv4(),
      invoiceNumber: `PMT-260310-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
      contractId,
      customerId,
      amount: 58000 * daysCount,
      lateFee: 0,
      type: InvoiceType.DAILY_BILLING,
      status: PaymentStatus.PAID,
      qrCodeData: '',
      dueDate: new Date(),
      paidAt: new Date(),
      extensionDays: daysCount,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: 58000,
      daysCount,
      periodStart: new Date(),
      periodEnd: new Date(),
      expiredAt: null,
      previousPaymentId: null,
      isHoliday: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    return invoiceRepo.create(invoice);
  }

  beforeEach(() => {
    savingTxRepo = new InMemorySavingTransactionRepository();
    contractRepo = new InMemoryContractRepository();
    invoiceRepo = new InMemoryInvoiceRepository();
    auditRepo = new InMemoryAuditLogRepository();
    savingService = new SavingService(savingTxRepo, contractRepo, invoiceRepo, auditRepo);
  });
```

### 9B. Test Cases — WAJIB semua diimplementasikan

```typescript
  // ============ CREDIT ============
  describe('creditFromPayment', () => {
    it('should credit saving when daily billing invoice is paid', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 5);

      const tx = await savingService.creditFromPayment(invoice.id, 'admin');

      expect(tx.type).toBe(SavingTransactionType.CREDIT);
      expect(tx.amount).toBe(SAVING_PER_DAY * 5);  // 5000 × 5 = 25000
      expect(tx.daysCount).toBe(5);
      expect(tx.balanceBefore).toBe(0);
      expect(tx.balanceAfter).toBe(25000);
      expect(tx.paymentId).toBe(invoice.id);

      // Verify contract.savingBalance updated
      const updated = await contractRepo.findById(contract.id);
      expect(updated!.savingBalance).toBe(25000);
    });

    it('should credit saving for manual payment', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 3, {
        type: InvoiceType.MANUAL_PAYMENT,
      });

      const tx = await savingService.creditFromPayment(invoice.id, 'admin');
      expect(tx.amount).toBe(SAVING_PER_DAY * 3);  // 5000 × 3 = 15000
    });

    it('should accumulate saving balance across multiple credits', async () => {
      const contract = await createContract();

      // Credit pertama: 5 hari
      const inv1 = await createPaidDailyInvoice(contract.id, contract.customerId, 5);
      await savingService.creditFromPayment(inv1.id, 'admin');

      // Credit kedua: 3 hari
      const inv2 = await createPaidDailyInvoice(contract.id, contract.customerId, 3);
      const tx2 = await savingService.creditFromPayment(inv2.id, 'admin');

      expect(tx2.balanceBefore).toBe(25000);  // dari credit pertama
      expect(tx2.balanceAfter).toBe(40000);   // 25000 + 15000

      const updated = await contractRepo.findById(contract.id);
      expect(updated!.savingBalance).toBe(40000);
    });

    it('should throw error for invoice with daysCount 0 or null', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 0);

      await expect(savingService.creditFromPayment(invoice.id, 'admin')).rejects.toThrow();
    });

    it('should create audit log for credit', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 2);

      await savingService.creditFromPayment(invoice.id, 'admin');

      const logs = await auditRepo.findRecent(10);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].module).toBe('saving');
    });
  });

  // ============ DEBIT SERVICE ============
  describe('debitForService', () => {
    it('should debit saving for motor service', async () => {
      const contract = await createContract({ savingBalance: 500000 });

      const tx = await savingService.debitForService(contract.id, {
        amount: 300000,
        description: 'Service rem depan + ganti kampas',
        photo: 'https://example.com/nota.jpg',
        notes: null,
      }, 'admin');

      expect(tx.type).toBe(SavingTransactionType.DEBIT_SERVICE);
      expect(tx.amount).toBe(300000);
      expect(tx.balanceBefore).toBe(500000);
      expect(tx.balanceAfter).toBe(200000);
      expect(tx.description).toBe('Service rem depan + ganti kampas');

      const updated = await contractRepo.findById(contract.id);
      expect(updated!.savingBalance).toBe(200000);
    });

    it('should throw error if amount exceeds saving balance', async () => {
      const contract = await createContract({ savingBalance: 100000 });

      await expect(savingService.debitForService(contract.id, {
        amount: 200000,
        description: 'Servis besar',
      }, 'admin')).rejects.toThrow('Saldo saving tidak cukup');
    });

    it('should throw error for contract not found', async () => {
      await expect(savingService.debitForService('nonexistent', {
        amount: 50000,
        description: 'Test',
      }, 'admin')).rejects.toThrow('Contract not found');
    });

    it('should allow debit on ACTIVE contract', async () => {
      const contract = await createContract({ status: ContractStatus.ACTIVE, savingBalance: 100000 });
      const tx = await savingService.debitForService(contract.id, { amount: 50000, description: 'Test' }, 'admin');
      expect(tx.balanceAfter).toBe(50000);
    });

    it('should allow debit on OVERDUE contract', async () => {
      const contract = await createContract({ status: ContractStatus.OVERDUE, savingBalance: 100000 });
      const tx = await savingService.debitForService(contract.id, { amount: 50000, description: 'Test' }, 'admin');
      expect(tx.balanceAfter).toBe(50000);
    });

    it('should allow debit on COMPLETED contract', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 100000 });
      const tx = await savingService.debitForService(contract.id, { amount: 50000, description: 'Test' }, 'admin');
      expect(tx.balanceAfter).toBe(50000);
    });

    it('should throw error on CANCELLED contract', async () => {
      const contract = await createContract({ status: ContractStatus.CANCELLED, savingBalance: 100000 });
      await expect(savingService.debitForService(contract.id, { amount: 50000, description: 'Test' }, 'admin'))
        .rejects.toThrow();
    });

    it('should throw error on REPOSSESSED contract', async () => {
      const contract = await createContract({ status: ContractStatus.REPOSSESSED, savingBalance: 100000 });
      await expect(savingService.debitForService(contract.id, { amount: 50000, description: 'Test' }, 'admin'))
        .rejects.toThrow();
    });
  });

  // ============ DEBIT TRANSFER ============
  describe('debitForTransfer', () => {
    it('should debit saving for STNK/BPKB transfer on COMPLETED contract', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 600000 });

      const tx = await savingService.debitForTransfer(contract.id, {
        amount: 400000,
        description: 'Biaya balik nama STNK + BPKB',
      }, 'admin');

      expect(tx.type).toBe(SavingTransactionType.DEBIT_TRANSFER);
      expect(tx.balanceAfter).toBe(200000);
    });

    it('should throw error on ACTIVE contract', async () => {
      const contract = await createContract({ status: ContractStatus.ACTIVE, savingBalance: 600000 });
      await expect(savingService.debitForTransfer(contract.id, { amount: 400000, description: 'Test' }, 'admin'))
        .rejects.toThrow('hanya tersedia pada kontrak yang sudah COMPLETED');
    });

    it('should throw error on OVERDUE contract', async () => {
      const contract = await createContract({ status: ContractStatus.OVERDUE, savingBalance: 600000 });
      await expect(savingService.debitForTransfer(contract.id, { amount: 400000, description: 'Test' }, 'admin'))
        .rejects.toThrow();
    });

    it('should throw error if amount exceeds balance', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 100000 });
      await expect(savingService.debitForTransfer(contract.id, { amount: 200000, description: 'Test' }, 'admin'))
        .rejects.toThrow('Saldo saving tidak cukup');
    });
  });

  // ============ CLAIM ============
  describe('claimSaving', () => {
    it('should claim full saving on COMPLETED contract', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 300000 });

      const tx = await savingService.claimSaving(contract.id, {}, 'admin');

      expect(tx.type).toBe(SavingTransactionType.DEBIT_CLAIM);
      expect(tx.amount).toBe(300000);
      expect(tx.balanceAfter).toBe(0);

      const updated = await contractRepo.findById(contract.id);
      expect(updated!.savingBalance).toBe(0);
    });

    it('should claim partial amount', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 300000 });

      const tx = await savingService.claimSaving(contract.id, { amount: 100000 }, 'admin');

      expect(tx.amount).toBe(100000);
      expect(tx.balanceAfter).toBe(200000);
    });

    it('should throw error on CANCELLED contract', async () => {
      const contract = await createContract({ status: ContractStatus.CANCELLED, savingBalance: 300000 });
      await expect(savingService.claimSaving(contract.id, {}, 'admin'))
        .rejects.toThrow('CANCELLED atau REPOSSESSED');
    });

    it('should throw error on REPOSSESSED contract', async () => {
      const contract = await createContract({ status: ContractStatus.REPOSSESSED, savingBalance: 300000 });
      await expect(savingService.claimSaving(contract.id, {}, 'admin'))
        .rejects.toThrow('CANCELLED atau REPOSSESSED');
    });

    it('should throw error on ACTIVE contract', async () => {
      const contract = await createContract({ status: ContractStatus.ACTIVE, savingBalance: 300000 });
      await expect(savingService.claimSaving(contract.id, {}, 'admin'))
        .rejects.toThrow('COMPLETED');
    });

    it('should throw error if saving balance is 0', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 0 });
      await expect(savingService.claimSaving(contract.id, {}, 'admin'))
        .rejects.toThrow('Saldo saving sudah habis');
    });

    it('should throw error if claim amount exceeds balance', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 100000 });
      await expect(savingService.claimSaving(contract.id, { amount: 200000 }, 'admin'))
        .rejects.toThrow('Saldo saving tidak cukup');
    });
  });

  // ============ REVERSAL ============
  describe('reverseCreditFromPayment', () => {
    it('should reverse saving credit when payment reverted', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 5);

      // Credit dulu
      await savingService.creditFromPayment(invoice.id, 'admin');
      const afterCredit = await contractRepo.findById(contract.id);
      expect(afterCredit!.savingBalance).toBe(25000);

      // Reverse
      const reversalTx = await savingService.reverseCreditFromPayment(invoice.id, 'admin');

      expect(reversalTx).not.toBeNull();
      expect(reversalTx!.type).toBe(SavingTransactionType.REVERSAL);
      expect(reversalTx!.amount).toBe(25000);
      expect(reversalTx!.balanceAfter).toBe(0);

      const afterReversal = await contractRepo.findById(contract.id);
      expect(afterReversal!.savingBalance).toBe(0);
    });

    it('should return null if no credit exists for payment', async () => {
      const result = await savingService.reverseCreditFromPayment('nonexistent', 'admin');
      expect(result).toBeNull();
    });

    it('should throw error if reversal would make balance negative', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 10);

      // Credit: 50000
      await savingService.creditFromPayment(invoice.id, 'admin');

      // Debit some: 30000
      await savingService.debitForService(contract.id, {
        amount: 30000,
        description: 'Service',
      }, 'admin');

      // savingBalance = 20000, tapi reversal = 50000 → negatif!
      await expect(savingService.reverseCreditFromPayment(invoice.id, 'admin'))
        .rejects.toThrow('Insufficient saving balance');
    });
  });

  // ============ TRANSACTION HISTORY ============
  describe('getTransactionHistory', () => {
    it('should return transactions ordered by createdAt DESC', async () => {
      const contract = await createContract({ savingBalance: 500000 });

      // Buat beberapa transaksi
      const inv1 = await createPaidDailyInvoice(contract.id, contract.customerId, 2);
      await savingService.creditFromPayment(inv1.id, 'admin');

      await savingService.debitForService(contract.id, { amount: 5000, description: 'Service 1' }, 'admin');

      const history = await savingService.getTransactionHistory(contract.id);

      expect(history.length).toBe(2);
      // Terbaru di atas
      expect(history[0].createdAt.getTime()).toBeGreaterThanOrEqual(history[1].createdAt.getTime());
    });
  });

  // ============ RECALCULATE ============
  describe('recalculateBalance', () => {
    it('should recalculate balance from transactions', async () => {
      const contract = await createContract({ savingBalance: 999999 }); // intentionally wrong

      // Manually create transactions
      await savingTxRepo.create({
        id: uuidv4(),
        contractId: contract.id,
        type: SavingTransactionType.CREDIT,
        amount: 50000,
        balanceBefore: 0,
        balanceAfter: 50000,
        paymentId: null,
        daysCount: 10,
        description: null,
        photo: null,
        createdBy: 'admin',
        notes: null,
        createdAt: new Date(),
      });

      await savingTxRepo.create({
        id: uuidv4(),
        contractId: contract.id,
        type: SavingTransactionType.DEBIT_SERVICE,
        amount: 20000,
        balanceBefore: 50000,
        balanceAfter: 30000,
        paymentId: null,
        daysCount: null,
        description: 'Service',
        photo: null,
        createdBy: 'admin',
        notes: null,
        createdAt: new Date(),
      });

      const balance = await savingService.recalculateBalance(contract.id, 'admin');

      expect(balance).toBe(30000); // 50000 - 20000

      const updated = await contractRepo.findById(contract.id);
      expect(updated!.savingBalance).toBe(30000);
    });
  });

  // ============ FULL FLOW ============
  describe('Full Integration Flow', () => {
    it('should handle complete saving lifecycle', async () => {
      // 1. Buat kontrak aktif
      const contract = await createContract();

      // 2. Bayar 10 hari → saving = 50000
      const inv1 = await createPaidDailyInvoice(contract.id, contract.customerId, 10);
      await savingService.creditFromPayment(inv1.id, 'admin');

      let c = await contractRepo.findById(contract.id);
      expect(c!.savingBalance).toBe(50000);

      // 3. Service motor → saving = 20000
      await savingService.debitForService(contract.id, {
        amount: 30000,
        description: 'Ganti ban depan',
      }, 'admin');

      c = await contractRepo.findById(contract.id);
      expect(c!.savingBalance).toBe(20000);

      // 4. Bayar lagi 5 hari → saving = 45000
      const inv2 = await createPaidDailyInvoice(contract.id, contract.customerId, 5);
      await savingService.creditFromPayment(inv2.id, 'admin');

      c = await contractRepo.findById(contract.id);
      expect(c!.savingBalance).toBe(45000);

      // 5. Kontrak completed
      await contractRepo.update(contract.id, { status: ContractStatus.COMPLETED });

      // 6. Balik nama → saving = 25000
      await savingService.debitForTransfer(contract.id, {
        amount: 20000,
        description: 'Biaya balik nama STNK',
      }, 'admin');

      c = await contractRepo.findById(contract.id);
      expect(c!.savingBalance).toBe(25000);

      // 7. Claim sisa → saving = 0
      await savingService.claimSaving(contract.id, {}, 'admin');

      c = await contractRepo.findById(contract.id);
      expect(c!.savingBalance).toBe(0);

      // 8. Verifikasi riwayat lengkap
      const history = await savingService.getTransactionHistory(contract.id);
      expect(history.length).toBe(5); // 2 CREDIT + 1 DEBIT_SERVICE + 1 DEBIT_TRANSFER + 1 DEBIT_CLAIM
    });

    it('should handle revert → re-pay → revert cycle correctly', async () => {
      const contract = await createContract();

      // Pay 5 days → credit saving
      const inv = await createPaidDailyInvoice(contract.id, contract.customerId, 5);
      await savingService.creditFromPayment(inv.id, 'admin');
      expect((await contractRepo.findById(contract.id))!.savingBalance).toBe(25000);

      // Revert → reverse saving
      await savingService.reverseCreditFromPayment(inv.id, 'admin');
      expect((await contractRepo.findById(contract.id))!.savingBalance).toBe(0);

      // Pay again → credit saving again
      const inv2 = await createPaidDailyInvoice(contract.id, contract.customerId, 5);
      await savingService.creditFromPayment(inv2.id, 'admin');
      expect((await contractRepo.findById(contract.id))!.savingBalance).toBe(25000);

      // Revert again → reverse saving again
      await savingService.reverseCreditFromPayment(inv2.id, 'admin');
      expect((await contractRepo.findById(contract.id))!.savingBalance).toBe(0);
    });
  });
});
```

### 9C. Update Test Setup di Test Suites Existing

**PENTING**: Contract entity sekarang punya field baru `savingBalance`. Update helper functions di test suites existing (`ContractService.test.ts`, `PaymentService.test.ts`, dll.) untuk include `savingBalance: 0` di contract creation.

Cari semua tempat di test files yang create Contract object dan tambahkan:

```typescript
savingBalance: 0,
```

---

## LANGKAH 10: UPDATE DOMAIN ENTITY CONTRACT

**File**: `packages/backend/src/domain/entities/Contract.ts`

Tambah field baru di interface Contract (setelah `gracePeriodDays`):

```typescript
savingBalance: number;
```

**PENTING**: Pastikan field ini ada di:

1. Domain entity interface (`Contract.ts`)
2. Prisma schema (`schema.prisma`) — sudah ditambah di Langkah 1C
3. Frontend types (`types/index.ts`) — sudah ditambah di Langkah 8A
4. Semua InMemory repository yang membuat Contract objects (test helpers, seed data, dll.)

---

## URUTAN IMPLEMENTASI (WAJIB DIIKUTI)

1. **Prisma Schema** (Langkah 1) → tambah enum, model, update relations → `npx prisma generate`
2. **Domain Layer** (Langkah 2) → enum, entity, interface, barrel exports
3. **Update Contract Entity** (Langkah 10) → tambah `savingBalance` field
4. **InMemorySavingTransactionRepository** (Langkah 3A)
5. **PrismaSavingTransactionRepository** (Langkah 3B)
6. **Barrel exports repositories** (Langkah 3C)
7. **DTOs** (Langkah 4A)
8. **SavingService** (Langkah 4B) → semua methods
9. **Barrel export services** (Langkah 4C)
10. **Integrasi PaymentService** (Langkah 5) → setter injection, auto-credit, auto-reversal
11. **Wiring di index.ts** (Langkah 6)
12. **SavingController** (Langkah 7A)
13. **Routes** (Langkah 7B)
14. **Tests** (Langkah 9) → SavingService.test.ts + update existing test helpers
15. **Frontend** (Langkah 8) → types, API, hooks, schemas, UI
16. Validasi: `cd packages/backend && npx tsc --noEmit`
17. Validasi: `cd packages/frontend && npx tsc --noEmit`
18. Validasi: `cd packages/backend && npm test`

---

## CHECKLIST FINAL

### Backend — Domain Layer

- [ ] Prisma schema: enum `SavingTransactionType` ditambahkan
- [ ] Prisma schema: model `SavingTransaction` ditambahkan dengan semua fields & indexes
- [ ] Prisma schema: `Contract.savingBalance` ditambahkan (Int, default 0)
- [ ] Prisma schema: relasi `savingTransactions` di Contract & Invoice
- [ ] `npx prisma generate` berhasil
- [ ] Domain entity: `SavingTransaction` interface di `src/domain/entities/SavingTransaction.ts`
- [ ] Domain entity: `Contract` interface updated dengan `savingBalance: number`
- [ ] Domain enum: `SavingTransactionType` di `src/domain/enums/index.ts`
- [ ] Domain constant: `SAVING_PER_DAY = 5000` di `src/domain/enums/index.ts`
- [ ] Domain interface: `ISavingTransactionRepository` di `src/domain/interfaces/`
- [ ] Barrel exports updated: entities, interfaces

### Backend — Infrastructure Layer

- [ ] `InMemorySavingTransactionRepository`: semua methods implemented
- [ ] `PrismaSavingTransactionRepository`: semua methods implemented
- [ ] Barrel exports updated: repositories

### Backend — Application Layer

- [ ] `SavingService`: `creditFromPayment()` — auto-credit saat invoice PAID
- [ ] `SavingService`: `reverseCreditFromPayment()` — auto-reverse saat payment revert
- [ ] `SavingService`: `debitForService()` — debit untuk service motor
- [ ] `SavingService`: `debitForTransfer()` — debit untuk balik nama (COMPLETED only)
- [ ] `SavingService`: `claimSaving()` — claim sisa saving (COMPLETED only, BUKAN CANCELLED/REPOSSESSED)
- [ ] `SavingService`: `getBalance()` — quick read saldo
- [ ] `SavingService`: `getTransactionHistory()` — riwayat transaksi DESC
- [ ] `SavingService`: `recalculateBalance()` — utility recalculate
- [ ] DTOs: `DebitSavingDto`, `ClaimSavingDto` di `dtos/index.ts`
- [ ] Barrel export: `SavingService` di `services/index.ts`

### Backend — Integrasi PaymentService

- [ ] `PaymentService`: property `savingService` + setter `setSavingService()`
- [ ] `PaymentService.payPayment()`: auto-credit saving setelah daily/manual payment PAID
- [ ] `PaymentService.revertPaymentStatus()`: auto-reverse saving saat revert dari PAID
- [ ] Try-catch wrapper: saving failure TIDAK menggagalkan payment flow

### Backend — Presentation Layer

- [ ] `SavingController`: 6 endpoints (getByContract, getBalance, debitService, debitTransfer, claim, recalculate)
- [ ] Routes: 6 routes saving ditambahkan di `routes/index.ts`
- [ ] Routes interface `RouteControllers` updated
- [ ] `index.ts`: repo wired, service initialized, setter called, controller created, passed to routes

### Backend — Tests

- [ ] `SavingService.test.ts`: test suite baru — minimal 28 test cases
- [ ] Credit tests: 5 cases (daily billing, manual payment, accumulation, invalid daysCount, audit log)
- [ ] Debit service tests: 7 cases (success, exceed balance, not found, ACTIVE, OVERDUE, COMPLETED, CANCELLED, REPOSSESSED)
- [ ] Debit transfer tests: 4 cases (COMPLETED success, ACTIVE fail, OVERDUE fail, exceed balance)
- [ ] Claim tests: 7 cases (full claim, partial claim, CANCELLED fail, REPOSSESSED fail, ACTIVE fail, zero balance, exceed balance)
- [ ] Reversal tests: 3 cases (success, no credit exists, insufficient balance)
- [ ] Transaction history: 1 case (ordering)
- [ ] Recalculate: 1 case (fix discrepancy)
- [ ] Full flow: 2 cases (complete lifecycle, revert cycle)
- [ ] Existing test helpers updated: `savingBalance: 0` di Contract creation
- [ ] `npm test` — ALL tests pass (existing + new)

### Frontend

- [ ] Types: `SavingTransactionType` enum, `SavingTransaction` interface, `SavingData` interface
- [ ] Types: `Contract.savingBalance` field ditambahkan
- [ ] API client: 6 methods saving (get, balance, debit service, debit transfer, claim, recalculate)
- [ ] SWR hooks: `useSavingByContract()`, `useSavingBalance()` — TTL SHORT
- [ ] Zod schemas: `debitSavingSchema`, `claimSavingSchema`
- [ ] Contract detail page: Kartu saldo saving
- [ ] Contract detail page: Tombol aksi (Servis, Balik Nama, Claim) dengan visibility rules
- [ ] Contract detail page: Riwayat transaksi saving (tabel, badge warna, format nominal)
- [ ] Contract detail page: Dialog debit (form + preview sisa saldo)
- [ ] Contract detail page: Dialog claim
- [ ] Contract detail page: Quick stats card saving
- [ ] Semua text UI dalam Bahasa Indonesia
- [ ] `npx tsc --noEmit` — NO errors

---

## CATATAN PENTING

1. **Saving bukan potongan dari daily rate.** Daily rate tetap Rp 58.000/63.000/83.000. Saving Rp 5.000 adalah **bagian dari pembayaran** yang disisihkan secara internal. Jangan ubah daily rate atau amount di invoice.

2. **SavingTransaction immutable.** Tidak ada update/delete. Jika perlu koreksi → buat REVERSAL baru. Ini memastikan audit trail lengkap.

3. **Denormalized `savingBalance` di Contract** adalah cache. Source of truth = SUM dari SavingTransaction. Gunakan `recalculateBalance()` jika ada discrepancy.

4. **Saving HANYA dari working days.** Holiday payments (isHoliday=true, amount=0) TIDAK menghasilkan saving.

5. **Claim saving HANYA untuk COMPLETED.** CANCELLED dan REPOSSESSED = saving hangus (forfeited). Record tetap ada tapi tidak bisa di-claim.

6. **Setter injection untuk SavingService di PaymentService.** Jangan constructor inject — akan circular dependency. Gunakan `setSavingService()` yang dipanggil di `index.ts` setelah kedua service diinstansiasi.

7. **Try-catch auto-credit/reversal.** Saving failure TIDAK boleh menggagalkan payment flow. Wrap dalam try-catch dan log error.

8. **Timezone**: Gunakan `getWibToday()` dari `src/domain/utils/dateUtils.ts` untuk logika tanggal hari ini. Timestamp (`createdAt`) tetap pakai `new Date()` (UTC).

9. **Bahasa UI**: Semua text yang dilihat user di frontend harus dalam Bahasa Indonesia. Kecuali: "Saving" (istilah umum).

10. **Audit log WAJIB** untuk setiap operasi mutasi saving (credit, debit, claim, reversal, recalculate).
