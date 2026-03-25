# CLAUDE.md — Application Layer (Business Logic)

> Instruksi untuk `packages/backend/src/application/`.
> Layer ini berisi semua business logic (services) dan DTO validation (Zod schemas).

---

## Aturan Application Layer

- Hanya boleh import dari **Domain layer** (`src/domain/`).
- TIDAK BOLEH import dari `src/infrastructure/` atau `src/presentation/`.
- Services menerima repository via **constructor injection** — bukan import concrete langsung.

```typescript
// BENAR:
class ContractService {
  constructor(
    private contractRepo: IContractRepository, // interface
    private paymentRepo: IPaymentRepository, // interface
    private settingRepo: ISettingRepository,
  ) {}
}

// SALAH:
import { PrismaContractRepository } from '../../infrastructure/repositories/...';
```

---

## Struktur Application Layer

```
src/application/
├── services/    # Business logic (ContractService, PaymentService, dll.)
├── dtos/        # Zod validation schemas (index.ts)
└── interfaces/  # Application-level interfaces (jika perlu)
```

---

## Services yang Ada

| Service           | Tanggung Jawab                                                    |
| ----------------- | ----------------------------------------------------------------- |
| `AuthService`     | Login, token validation                                           |
| `CustomerService` | CRUD customer, soft delete                                        |
| `ContractService` | Lifecycle kontrak, DP, receive unit, cancel, repossess, extension |
| `PaymentService`  | Generate billing, mark paid, rollover, manual payment, revert     |
| `SettingService`  | Settings CRUD, seedDefaults, migrateSettings                      |
| `SavingService`   | Financial reports (tidak ada di seed/test suite terpisah)         |

---

## DTO Validation (Zod)

- Semua Zod schemas ada di `application/dtos/index.ts`.
- **Jangan buat schema baru di file page/controller/route.**
- Validasi dijalankan di service, bukan di controller.
- Untuk form select dengan Radix/ShadCN → lihat frontend CLAUDE.md.

---

## Business Logic Detail

### Down Payment (DP)

- Setiap kontrak baru WAJIB bayar DP sebelum unit bisa diterima.
- DP amount berdasarkan kombinasi motor + battery (lihat root CLAUDE.md).
- **Skema pembayaran DP:**
  - `FULL` → 1 invoice (type=DP) dengan amount = full DP amount
  - `INSTALLMENT` → 2 invoices (type=DP_INSTALLMENT):
    - Cicilan 1: `Math.ceil(dpAmount / 2)`
    - Cicilan 2: `Math.floor(dpAmount / 2)`

- **`receiveUnit()` WAJIB validasi:**
  - `dpFullyPaid === true` — jika false, throw error
  - `bastPhoto` wajib diisi (tidak boleh empty string/null)
  - `bastNotes` opsional
  - Tagihan harian mulai H+1 dari `unitReceivedAt` (hari penerimaan = bebas tagihan)

---

### Payment Lifecycle (Unified PMT-xxx)

Semua pembayaran (DP, harian, manual) menggunakan satu entitas Invoice/Payment dengan nomor `PMT-YYMMDD-NNNN`.

**Status invoice:** `PENDING → PAID`, atau `PENDING → EXPIRED`, atau `PENDING → VOID`, atau `PENDING → FAILED`

**Flow normal (same-day):**

1. Scheduler 00:01 WIB → `generateDailyPayments()` → buat PaymentDay records + Invoice PENDING untuk hari ini
2. Admin mark paid → Invoice status PENDING → PAID
3. PAID → `syncContractFromPaymentDays()` → update contract summary

**Rollover mechanism:**

- Jika tagihan hari ini tidak dibayar, besok:
  - Tagihan lama di-EXPIRED
  - Tagihan baru dibuat dengan akumulasi semua UNPAID days dari `billingStartDate`
  - `daysCount` dan `amount` bertambah
- Customer WAJIB bayar tagihan terbaru (akumulasi) — tagihan lama sudah EXPIRED.

**Manual payment (1-7 hari ke depan):**

- Admin buat tagihan untuk N hari ke depan
- Jika sudah ada tagihan aktif (PENDING): tagihan lama di-cancel, tagihan baru = merge (amount lama + baru)
- Tagihan merged punya `previousPaymentId` → chain ke tagihan sebelumnya
- Jika tagihan merged di-cancel → tagihan sebelumnya di-reactivate (status → PENDING)

**Field Invoice yang penting:**

```typescript
{
  dailyRate: number,       // tarif harian saat tagihan dibuat (snapshot)
  daysCount: number,       // jumlah hari yang di-cover tagihan ini
  periodStart: Date,       // awal periode tagihan
  periodEnd: Date,         // akhir periode tagihan
  expiredAt: Date | null,  // kapan tagihan expired (untuk rollover)
  previousPaymentId: string | null,  // chain rollover/merge
  isHoliday: boolean,      // apakah tagihan libur bayar (amount=0)
  lateFee: number,         // total denda (terpisah dari amount)
}
```

---

### PaymentDay System

Model `PaymentDay` menyimpan status eksplisit per-tanggal per-kontrak:

```typescript
enum PaymentDayStatus {
  UNPAID,
  PENDING,
  PAID,
  HOLIDAY,
  VOIDED,
}
```

- `generateDailyPayments()` — backfill PaymentDay dari `billingStartDate` sampai today
- `toDateKey()` dari `domain/utils/dateUtils.ts` untuk key "YYYY-MM-DD" — JANGAN `toISOString()`

---

### `syncContractFromPaymentDays()` — Contiguous Walk

Method di `PaymentService` yang recalculate contract summary dari PaymentDay records.

**Algoritma (Contiguous Walk):**

1. Start dari `billingStartDate`
2. Walk forward hari per hari
3. Hitung PAID + HOLIDAY berturut-turut
4. **Stop di gap pertama** (UNPAID/PENDING/VOIDED hari yang tidak ada invoice aktif)
5. Trailing contiguous HOLIDAY dihitung (contoh: PAID s/d 28 Maret + HOLIDAY 29-31 → endDate = 31 Maret)

**Setelah sync:**

- Update `totalDaysPaid`, `workingDaysPaid`, `holidayDaysPaid`, `ownershipProgress`, `endDate`
- **Bidirectional status transition** otomatis:
  - Jika `endDate + gracePeriodDays >= today` → status OVERDUE → ACTIVE
  - Jika `endDate + gracePeriodDays < today` → status ACTIVE → OVERDUE
- Jika `totalDaysPaid >= 1278` → status → COMPLETED

**Penting:** `creditDayToContract()` sudah dihapus (dead code). Semua path pakai `syncContractFromPaymentDays()`.

---

### Libur Bayar (Holiday System)

**`isLiburBayar(contract, date)` di PaymentService:**

```typescript
// OLD_CONTRACT: semua hari Minggu
if (contract.holidayScheme === HolidayScheme.OLD_CONTRACT) {
  return date.getDay() === 0; // 0 = Minggu
}

// NEW_CONTRACT: tanggal 29-31 setiap bulan
if (contract.holidayScheme === HolidayScheme.NEW_CONTRACT) {
  return date.getDate() > 28;
}
```

**Detail NEW_CONTRACT:**

- Februari non-leap: 28 hari → tidak ada libur
- Februari leap: hanya 29 Feb libur
- Bulan 30 hari: 2 hari libur (29-30)
- Bulan 31 hari: 3 hari libur (29-31)

**Tagihan hari Libur Bayar:**

- `amount = 0`, `isHoliday = true`, status auto-PAID
- Tetap credit 1 hari ke `totalDaysPaid` dan `holidayDaysPaid`
- Holiday tidak kena `lateFee`

**endDate advancement:**

- Saat advance endDate, skip hari Libur Bayar sesuai scheme contract

---

### Contract Status Machine

```
ACTIVE → OVERDUE      (otomatis scheduler, endDate + gracePeriodDays < today)
ACTIVE → COMPLETED    (otomatis, totalDaysPaid >= 1278)
ACTIVE → CANCELLED    (manual admin, butuh alasan)
ACTIVE → REPOSSESSED  (manual admin)
OVERDUE → ACTIVE      (otomatis setelah bayar, syncContractFromPaymentDays)
OVERDUE → REPOSSESSED (manual admin)
OVERDUE → CANCELLED   (manual admin)
```

**Terminal states (tidak bisa diubah):**

- `COMPLETED` — ownership lunas
- `CANCELLED` — alasan di-append ke notes: `[CANCELLED] alasan...`
- `REPOSSESSED` — `repossessedAt` timestamp di-set

**Saat cancel/repossess:** Semua PENDING + FAILED invoices otomatis di-void + audit log.

---

### Payment Revert

- Admin bisa revert dari PAID atau VOID → kembali ke PENDING.
- **Jika revert PAID:**
  - DP payment → kurangi `dpPaidAmount`, set `dpFullyPaid = false` jika perlu
  - Daily payment → `syncContractFromPaymentDays()` untuk recalculate semua
- Audit log wajib dicatat untuk setiap revert.

---

### Late Payment Penalty (Denda Keterlambatan)

**PENTING: 2 setting TERPISAH — JANGAN dicampur:**

| Setting              | Default | Fungsi                                           |
| -------------------- | ------- | ------------------------------------------------ |
| `penalty_grace_days` | 2       | Toleransi hari sebelum denda mulai berlaku       |
| `late_fee_per_day`   | 20.000  | Nominal denda per hari (Rp)                      |
| `grace_period_days`  | 7       | Masa tenggang status OVERDUE (BUKAN untuk denda) |

- `grace_period_days` → kapan status jadi OVERDUE (endDate + N hari)
- `penalty_grace_days` → kapan denda mulai berlaku (independen dari status)

**Kebijakan:**

- **`OLD_CONTRACT` (holidayScheme=OLD_CONTRACT) → TIDAK kena denda sama sekali.**
- `NEW_CONTRACT` → kena denda jika hari keterlambatan `>= penalty_grace_days`.

**Rumus:** Hari kena denda jika `(today - tanggalHari) >= penalty_grace_days`

**Contoh** (EdPower Rp 83k, today=10, terakhir bayar=hari ke-4):

- Hari 5: diff=5 → kena denda → 83k + 20k = **103k**
- Hari 6-7: diff=4,3 → kena denda → (83k+20k)×2 = **206k**
- Hari 8: diff=2 → kena denda → (83k+20k)+(83k)×2 = **269k** (?)
- Hari 9: diff=1 < 2 → tidak kena denda
- Hari 10: diff=0 < 2 → tidak kena denda

**Implementasi:**

```typescript
// Pure function di domain/utils/lateFeeCalculator.ts
computeLateFee(dailyRates, penaltyGraceDays, lateFeePerDay): number

// Async wrapper di PaymentService (baca setting → panggil computeLateFee)
PaymentService.calculateLateFee(contractId, daysList): Promise<number>
```

Berlaku untuk: daily billing (scheduler), manual payment, rollover, reduce payment, extension.

**SettingService:** `migrateSettings()` otomatis update setting lama saat deploy. Tidak perlu manual SQL.

---

### Payment Calendar Colors (untuk reference frontend)

| Warna   | Status       | Kondisi                                             |
| ------- | ------------ | --------------------------------------------------- |
| Hijau   | `paid`       | PaymentDay status = PAID                            |
| Kuning  | `pending`    | Ada invoice PENDING (hari ini atau mendatang)       |
| Merah   | `overdue`    | Tanggal sudah lewat dalam tagihan aktif (tunggakan) |
| Biru    | `holiday`    | PaymentDay status = HOLIDAY                         |
| Abu-abu | `not_issued` | Tidak ada PaymentDay record untuk tanggal ini       |
