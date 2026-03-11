# Prompt: Refactor Seed File — Pisahkan Reference Data dan Legacy Import

## Konteks Project

Aplikasi **WEDISON RTO** (Rent To Own) — sistem manajemen internal untuk penyewaan motor listrik dengan skema kepemilikan. Stack: **Express + Prisma + PostgreSQL**, monorepo (`packages/backend` + `packages/frontend`), di-deploy ke **Railway** (auto-redeploy setiap push ke main).

### Arsitektur Seed Saat Ini

File `packages/backend/prisma/seed.ts` **mencampur semua jenis data**:
- Reference/master data (admin user, app settings)
- Data bisnis legacy (79 kontrak + 80 customer yang sudah ada sebelum app dibuat)
- Payment history (DP + daily billing invoices) yang di-generate dari data kontrak legacy
- PaymentDay records (status per-tanggal per-kontrak)
- Audit logs

**Masalah:**
1. Seed jalan di start command Railway (`prisma db seed`) setiap deploy — legacy data bisa konflik
2. Tidak ada pemisahan antara data **wajib supaya app jalan** vs **data migrasi satu kali**
3. Banyak helper functions di seed.ts yang duplikasi dari `domain/utils/` (`getWibToday`, `toDateKey`, `isLiburBayar`)
4. Constants (`RATES`, `DPS`) diduplikasi — padahal sudah ada di `domain/enums/index.ts` sebagai `DAILY_RATES` dan `DP_AMOUNTS`

### Yang Sudah Dilakukan App Saat Startup

**PENTING**: File `packages/backend/src/index.ts` sudah melakukan ini saat app start:
```
authService.seedDefaultAdmin()     → upsert admin user
settingService.seedDefaults()      → upsert semua default settings
settingService.migrateSettings()   → auto-update setting lama ke nilai baru
```

Artinya admin user dan settings **sudah di-handle oleh app**, jadi `prisma db seed` seharusnya tidak perlu mengulanginya. Namun untuk safety (jika app belum start tapi seed perlu jalan duluan), tetap boleh ada di seed sebagai backup.

### File & Struktur yang Perlu Kamu Pahami

Baca file-file ini sebelum mulai refactor:

**Data sources:**
- `packages/backend/prisma/data/customers.ts` — 80 customers, interface `CustomerSeed`
- `packages/backend/prisma/data/contracts.ts` — kontrak legacy, interface `ContractSeed`, type `DateTuple = [year, month, day]`
- **Catatan**: seed.ts saat ini import dari `contracts1.ts` (ada 2 versi file). Pilih yang benar dan konsistenkan.

**Constants & enums (sudah ada, JANGAN duplikasi):**
- `packages/backend/src/domain/enums/index.ts` — berisi `DAILY_RATES`, `DP_AMOUNTS`, `DEFAULT_OWNERSHIP_TARGET_DAYS`, `DEFAULT_GRACE_PERIOD_DAYS`, `DEFAULT_PENALTY_GRACE_DAYS`, `DEFAULT_LATE_FEE_PER_DAY`, `SAVING_PER_DAY`, dll.

**Utility functions (sudah ada, JANGAN duplikasi):**
- `packages/backend/src/domain/utils/dateUtils.ts` — `getWibToday()`, `toDateKey()`, `getWibDateParts()`
- `packages/backend/src/domain/utils/lateFeeCalculator.ts` — `computeLateFee()`

**Services yang relevan:**
- `packages/backend/src/application/services/SettingService.ts` — `seedDefaults()`, `migrateSettings()`
- `packages/backend/src/application/services/PaymentService.ts` — `generateDailyPayments()`, `syncContractFromPaymentDays()`, `isLiburBayar()`

**Prisma schema & config:**
- `packages/backend/prisma/schema.prisma` — semua models, enums, unique constraints
- `packages/backend/package.json` — prisma seed config: `"prisma": { "seed": "npx tsx prisma/seed.ts" }`

**Deployment:**
- `railway.json` — start command: `prisma db push → prisma db seed → node dist/index.js`
- Project **tidak pakai** migration files (`prisma migrate`), hanya `prisma db push`

**App startup flow** (`packages/backend/src/index.ts`):
1. Init repos (Prisma atau InMemory berdasarkan `DATABASE_URL`)
2. Init services
3. `authService.seedDefaultAdmin()` + `settingService.seedDefaults()` + `migrateSettings()`
4. InMemory only: `seedDummyData()` untuk dev
5. Start scheduler (node-cron, 00:01 WIB)
6. Start Express server

---

## Yang Harus Kamu Lakukan

Refactor `seed.ts` menjadi **arsitektur seed yang bersih** dengan pemisahan berikut:

### 1. `prisma/seed.ts` — Reference/Master Data ONLY (Idempotent)

File ini **jalan setiap deploy** via Railway start command. Harus 100% idempotent dan cepat.

**Isi hanya:**
- **Admin user** → upsert by username (backup dari `seedDefaultAdmin()` di app startup)
- **App settings** → upsert by key (backup dari `seedDefaults()` di app startup)

**Aturan:**
- Semua operasi **harus `upsert`**
- `update: {}` — jangan overwrite setting yang sudah dikustomisasi admin
- Import constants dari `domain/enums/index.ts`, **JANGAN** duplikasi `RATES`, `DPS`, `DEFAULT_SETTINGS` di file ini
- Tidak boleh ada `deleteMany` atau `createMany`
- Harus cepat (< 3 detik)
- Log ringkas: `[SEED] Settings: 10 upserted`, `[SEED] Admin user: ready`
- **HAPUS** semua logic legacy: `seedCustomers()`, `seedContracts()`, `resetData()`, `countCalendarDays()`, dan semua helper functions yang hanya dipakai untuk legacy import
- **HAPUS** CLI flags `--reset` dan `--force` — tidak relevan untuk reference data saja

### 2. `packages/backend/scripts/import-legacy-data.ts` — One-Time Legacy Import

File ini untuk **mengimpor semua data bisnis legacy**. Dijalankan **sekali** dari local dengan connection string production.

**Isi:**
- Import customers dari `../prisma/data/customers.ts`
- Import contracts dari `../prisma/data/contracts.ts` (atau `contracts1.ts` — tentukan mana yang benar)
- Generate DP payments (FULL / INSTALLMENT)
- Generate daily billing invoices (PAID) untuk hari-hari yang sudah dibayar
- Generate PaymentDay records dari billingStartDate sampai today
- Generate audit logs untuk setiap contract creation
- **Pindahkan semua logic dari `seedContracts()` yang ada sekarang ke sini**

**Aturan:**
- **Harus idempotent** — cek `contractNumber` / `ktpNumber` sebelum create, skip jika sudah ada
- Import constants dari `domain/enums/index.ts` (`DAILY_RATES`, `DP_AMOUNTS`, `DEFAULT_OWNERSHIP_TARGET_DAYS`, `DEFAULT_GRACE_PERIOD_DAYS`)
- Import date helpers dari `domain/utils/dateUtils.ts` (`getWibToday`, `toDateKey`)
- Helper functions yang **hanya** dipakai di sini (`countCalendarDays`, `isLiburBayar`, `fmtDateCompact`, `addDays`, `startOfDay`, `endOfDay`) → taruh di file terpisah `packages/backend/scripts/utils/seed-helpers.ts` atau inline di file ini
- **TIDAK** di start command Railway — dijalankan manual saja
- Support `--dry-run` flag: tampilkan apa yang akan di-create tanpa actually insert
- Support `--reset` flag: hapus semua data business (invoices, contracts, customers, paymentDays, auditLogs, savingTransactions) lalu re-import. Butuh `--force` di production.
- Log detail per operasi: berapa created, berapa skipped
- Summary di akhir: total customers, contracts, payments, paymentDays, auditLogs
- **Dijalankan dengan**: `cd packages/backend && DATABASE_URL="postgresql://..." npx tsx scripts/import-legacy-data.ts`
- PENTING: **Tagihan PENDING (belum dibayar) TIDAK dibuat oleh script ini**. Biarkan scheduler yang generate saat app start — scheduler akan menghitung `lateFee` dengan benar. Hari-hari yang belum dibayar tetap menjadi PaymentDay UNPAID.

### 3. Helper Functions — Reuse atau Buat Baru

**Prinsip: jangan duplikasi.** Cek dulu apakah function sudah ada:

| Function | Sudah ada di | Action |
|----------|-------------|--------|
| `getWibToday()` | `domain/utils/dateUtils.ts` | Import dari sana |
| `toDateKey()` | `domain/utils/dateUtils.ts` | Import dari sana |
| `isLiburBayar()` | `PaymentService.ts` (method) | Buat versi standalone jika perlu |
| `countCalendarDays()` | Hanya di seed.ts | Pindahkan ke `scripts/utils/seed-helpers.ts` |
| `addDays()`, `startOfDay()`, `endOfDay()` | Hanya di seed.ts | Pindahkan ke `scripts/utils/seed-helpers.ts` |
| `fmtDateCompact()` | Hanya di seed.ts | Pindahkan ke `scripts/utils/seed-helpers.ts` |
| `DAILY_RATES`, `DP_AMOUNTS` | `domain/enums/index.ts` | Import dari sana |
| `DEFAULT_*` constants | `domain/enums/index.ts` | Import dari sana |

### 4. `seed-dev-data.ts` — TIDAK PERLU

App sudah punya `seedDummyData()` di `src/index.ts` yang otomatis jalan saat InMemory mode (tanpa `DATABASE_URL`). Jangan buat file dev seed terpisah karena akan tumpang tindih.

---

## Struktur File yang Diharapkan

```
packages/backend/
├── prisma/
│   ├── seed.ts                    # Reference data only (admin + settings, jalan tiap deploy)
│   ├── schema.prisma
│   └── data/
│       ├── customers.ts           # Data customer legacy (sudah ada, jangan ubah)
│       └── contracts.ts           # Data kontrak legacy (sudah ada, jangan ubah)
├── scripts/
│   ├── import-legacy-data.ts      # One-time legacy import (dijalankan manual)
│   └── utils/
│       └── seed-helpers.ts        # Helper functions: countCalendarDays, addDays, isLiburBayar, dll.
└── src/
    └── domain/
        ├── enums/index.ts         # DAILY_RATES, DP_AMOUNTS, constants (sudah ada)
        └── utils/
            ├── dateUtils.ts       # getWibToday, toDateKey (sudah ada)
            └── lateFeeCalculator.ts  # computeLateFee (sudah ada)
```

---

## Railway Config yang Diharapkan

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npm install --workspace=packages/backend && DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npm run build --workspace=packages/backend"
  },
  "deploy": {
    "startCommand": "cd packages/backend && npx prisma db push --skip-generate --accept-data-loss && npx prisma db seed && node dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

> `prisma db seed` sekarang aman jalan tiap deploy karena isinya hanya upsert reference data (< 3 detik).
> **Tetap pakai `prisma db push`**, bukan `prisma migrate deploy`.

---

## Prisma Models yang Relevan (untuk reference)

```
User          — admin users, unique: username
Customer      — RTO customers, unique: ktpNumber, soft delete
Contract      — RTO contracts, unique: contractNumber
Invoice       — unified payments (DP/daily/manual), unique: invoiceNumber
PaymentDay    — per-date per-contract tracking, unique: (contractId, date)
AuditLog      — mutation history
Setting       — key-value config, unique: key
SavingTransaction — dana sisihan tracking, FK to Invoice
```

---

## Contoh Hasil Akhir: `seed.ts` (Reference Only)

```typescript
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
// Import constants dari domain — JANGAN duplikasi
// Sesuaikan path relatif dari prisma/seed.ts ke src/domain/
// Jika import dari TypeScript source tidak bisa (karena belum di-compile),
// hardcode values tapi tambahkan komentar referensi ke source of truth

const prisma = new PrismaClient();

const DEFAULT_SETTINGS = [
  // Referensi: packages/backend/src/domain/enums/index.ts
  { key: "ownership_target_days", value: "1278", description: "Target hari kepemilikan penuh" },
  { key: "grace_period_days", value: "7", description: "Masa tenggang sebelum status OVERDUE" },
  { key: "penalty_grace_days", value: "2", description: "Toleransi (hari) sebelum denda berlaku" },
  { key: "late_fee_per_day", value: "20000", description: "Denda keterlambatan per hari (Rp)" },
  { key: "max_rental_days", value: "7", description: "Maksimum hari pembayaran manual" },
  { key: "default_holiday_scheme", value: "NEW_CONTRACT", description: "Skema libur bayar default" },
  // ... tambahkan semua settings yang ada
];

async function main() {
  console.log("[SEED] Upserting reference data...\n");

  // Admin user
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { id: uuidv4(), username: "admin", password: "admin123", fullName: "Administrator", role: "ADMIN", isActive: true },
  });
  console.log(`[SEED] Admin user: ${admin.username} (ready)`);

  // Settings
  for (const s of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},  // Jangan overwrite — admin mungkin sudah kustomisasi
      create: { id: uuidv4(), ...s },
    });
  }
  console.log(`[SEED] Settings: ${DEFAULT_SETTINGS.length} keys (upserted)`);

  console.log("\n[SEED] Done. Reference data is ready.");
}

main()
  .catch((e) => { console.error("[SEED] Failed:", e.message || e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

---

## Checklist Output

Pastikan:
- [ ] `seed.ts` HANYA berisi admin user + settings, 100% idempotent, tidak ada legacy logic
- [ ] `import-legacy-data.ts` berisi SEMUA logic legacy import (customers, contracts, payments, paymentDays, auditLogs)
- [ ] `import-legacy-data.ts` idempotent (skip existing), support `--dry-run` dan `--reset`
- [ ] `seed-helpers.ts` berisi helper functions yang hanya dipakai legacy import
- [ ] Constants di-import dari `domain/enums/index.ts`, TIDAK diduplikasi
- [ ] Date helpers di-import dari `domain/utils/dateUtils.ts` jika memungkinkan
- [ ] Tidak ada logic bisnis yang hilang saat refactor
- [ ] **Tagihan PENDING TIDAK dibuat oleh script** — scheduler yang handle
- [ ] `contracts1.ts` vs `contracts.ts` — pilih satu, hapus yang tidak dipakai
- [ ] CLI flags (`--reset`, `--force`) hanya ada di `import-legacy-data.ts`
- [ ] Logging yang jelas di setiap file
- [ ] Komentar di awal setiap file: kapan, bagaimana, dan siapa yang menjalankan
- [ ] Railway config tetap pakai `prisma db push` (bukan `migrate deploy`)
- [ ] `seed-dev-data.ts` TIDAK dibuat (sudah ada `seedDummyData()` di `index.ts`)
