# CLAUDE.md — Instructions for Claude AI

> File ini berisi instruksi, aturan, dan konteks penting yang WAJIB diikuti oleh Claude saat bekerja di project ini.
> File ini di-load otomatis setiap sesi — jadi isinya harus selalu relevan dan akurat.
>
> **File lain yang terkait:**
> - `README.md` — Dokumentasi project (tech stack, API endpoints, architecture, cara setup)
> - `docs/CHANGELOG.md` — History lengkap semua perubahan per phase

## Penggunaan Skills (WAJIB)

**Claude WAJIB mengecek dan menggunakan available skills (slash commands) sebelum mengerjakan task apapun.** Setiap kali menerima request dari user:
1. Periksa daftar skills yang tersedia di system context.
2. Jika ada skill yang cocok dengan trigger condition-nya, **panggil skill tersebut via Skill tool** sebelum mulai bekerja.
3. Jangan skip skill hanya karena merasa bisa mengerjakan langsung — skills menyediakan workflow dan quality gates yang penting.

Contoh skills yang sering relevan:
- `superpowers-using-superpowers` — di awal setiap conversation
- `superpowers-writing-plans` — sebelum implementasi multi-step
- `superpowers-verification-before-completion` — sebelum klaim selesai
- `superpowers-systematic-debugging` — saat ada bug atau test failure

---

## Bahasa Komunikasi

**Claude WAJIB selalu berkomunikasi dalam Bahasa Indonesia dengan user.** Semua penjelasan, pertanyaan, summary, dan output teks harus dalam Bahasa Indonesia. Kecuali untuk:
- Kode program (tetap dalam bahasa Inggris)
- Istilah teknis yang sudah umum (commit message, variable name, error message, dll.)
- Nama file, path, dan command terminal

---

## Documentation Rules (WAJIB DIIKUTI)

Claude WAJIB mencatat setiap perubahan signifikan ke file yang tepat. Berikut panduan lengkapnya:

### Kapan dan di mana mencatat

| Jenis Perubahan | Catat Di | Contoh |
|-----------------|----------|--------|
| Aturan/instruksi baru untuk Claude | `CLAUDE.md` (file ini) | "Selalu gunakan upsert untuk seeding", "Jangan import domain dari infrastructure" |
| Perubahan tech stack, API endpoint, architecture, setup | `README.md` | Tambah endpoint baru, ubah port, tambah dependency |
| Fitur baru, bug fix, refactor, perubahan kode apapun | `docs/CHANGELOG.md` | "Phase 7: JWT Authentication", "Fix: billing rollover bug" |
| Pattern/konvensi yang dipelajari dari interaksi | `.claude/memory/MEMORY.md` | "User prefer Indonesian UI text", "Tailwind v4 syntax" |

### Aturan pencatatan

1. **Setelah menyelesaikan perubahan kode yang signifikan** (fitur baru, bug fix, refactor), LANGSUNG update file dokumentasi yang relevan tanpa menunggu diminta user.
2. **Jika context window mendekati penuh**, PRIORITASKAN mencatat semua perubahan yang belum dicatat sebelum sesi berakhir. Ini krusial agar sesi berikutnya tidak kehilangan konteks.
3. **Jangan duplikasi informasi** antar file. Misalnya: daftar API endpoint hanya ada di `README.md`, jangan copy ke `CLAUDE.md` juga.
4. **Saat menambah API endpoint baru**, update tabel API di `README.md` — jangan lupa.
5. **Saat ada keputusan arsitektur atau business rule baru**, update bagian yang relevan di `CLAUDE.md` (file ini).
6. **Format changelog entry** harus konsisten: tanggal, judul, context, what was changed, files modified, test count.

### Contoh: kapan TIDAK perlu update

- Perubahan kecil seperti fix typo, adjust padding — tidak perlu dicatat.
- Exploratory work (baca file, cari bug) — tidak perlu dicatat sampai ada perubahan aktual.

---

## Project Identity

- **Company**: WEDISON — perusahaan motor listrik (electric motorcycle)
- **System**: Internal RTO (Rent To Own) Management System
- **Users**: Hanya admin internal WEDISON. Tidak ada login untuk customer/end-user.
- **Bahasa UI**: Bahasa Indonesia untuk semua text yang dilihat user (button, heading, placeholder, toast, dialog, dll.)

### Motor Models & Pricing

Ada 5 kombinasi motor + baterai dengan harga berbeda:

| Motor + Battery | Daily Rate | DP Amount |
|----------------|-----------|-----------|
| Athena Regular Battery | Rp 58.000/hari | Rp 530.000 |
| Athena Extended Battery | Rp 63.000/hari | Rp 580.000 |
| Victory Regular Battery | Rp 58.000/hari | Rp 530.000 |
| Victory Extended Battery | Rp 63.000/hari | Rp 580.000 |
| EdPower (hanya 1 tipe baterai) | Rp 83.000/hari | Rp 780.000 |

- **Ownership Target**: 1.278 hari kerja (bukan calendar days — Libur Bayar Sundays tidak dihitung)
- **Payment Model**: Same-day — tagihan (PMT-xxx) di-generate jam 00:01 WIB untuk hari itu juga (bukan hari besok) dengan status PENDING. Jika tidak dibayar, tagihan berikutnya rollover (akumulasi amount).
- **Manual Payment**: Admin bisa buat tagihan manual 1-7 hari ke depan sebagai opsi tambahan.

---

## Architecture Rules

### Clean Architecture — Layer Dependency

```
Domain (paling dalam) → Application → Infrastructure → Presentation (paling luar)
```

**Aturan import yang WAJIB diikuti:**

- **Domain layer** (`src/domain/`): Berisi entities, enums, repository interfaces, constants.
  - TIDAK BOLEH import dari layer manapun. Ini layer paling murni.
  - Contoh benar: `domain/entities/Customer.ts` mendefinisikan interface Customer.
  - Contoh SALAH: `domain/entities/Customer.ts` import dari `infrastructure/repositories/`.

- **Application layer** (`src/application/`): Berisi services (business logic) dan DTOs (Zod validation).
  - Hanya boleh import dari Domain layer.
  - Services menerima repository interfaces via constructor injection, bukan concrete implementations.
  - Contoh benar: `ContractService` constructor menerima `IContractRepository` (interface).
  - Contoh SALAH: `ContractService` langsung import `PrismaContractRepository` (concrete).

- **Infrastructure layer** (`src/infrastructure/`): Berisi repository implementations, middleware, config, scheduler.
  - Boleh import dari Domain dan Application.
  - Ada 2 jenis repository: `InMemory*Repository` (untuk dev/test) dan `Prisma*Repository` (untuk production).
  - Pemilihan repo berdasarkan env var `DATABASE_URL` — lihat `src/index.ts`.

- **Presentation layer** (`src/presentation/`): Berisi controllers dan routes.
  - Hanya boleh memanggil Application services.
  - Controller TIDAK boleh berisi business logic — hanya parse request, panggil service, return response.

**Implikasi praktis saat development:**
- Menambah entity baru → buat di `domain/entities/`, buat interface repo di `domain/interfaces/`
- Menambah business logic → taruh di service yang relevan di `application/services/`
- Menambah database query → implementasi di `infrastructure/repositories/` (kedua varian)
- Menambah API endpoint → controller di `presentation/controllers/`, route di `presentation/routes/`
- Unit tests → selalu gunakan InMemory repositories, TIDAK perlu database

### Backend Patterns (Detail)

**Repository Pattern:**
- Semua data access WAJIB melalui repository interfaces (`ICustomerRepository`, `IContractRepository`, dll.).
- Dua implementasi per interface: `InMemory*` (Map-based, untuk dev/test) dan `Prisma*` (PostgreSQL, untuk production).
- Conditional initialization di `src/index.ts`: ada `DATABASE_URL` → Prisma, tidak ada → InMemory.
- Saat menambah method baru di repository, HARUS update kedua implementasi (InMemory + Prisma).

**DTO Validation:**
- Semua input dari API di-validate menggunakan Zod schemas di `application/dtos/index.ts`.
- Jangan validate di controller — validate di service saat memproses DTO.

**Audit Logging:**
- Setiap operasi mutasi (create, update, delete, payment) WAJIB dicatat ke AuditLog.
- Format: `{ userId, action, module, entityId, description, metadata }`.
- Jangan lupa audit log saat menambah fitur baru yang mengubah data.

**Soft Delete:**
- Customer dan Contract menggunakan soft delete (`isDeleted: boolean`, `deletedAt: DateTime?`).
- Semua query `findAll`, `search`, `count` HARUS filter `isDeleted: false` secara default.
- Hard delete TIDAK digunakan di project ini.

**Sequential Numbering:**
- Contract: `RTO-YYMMDD-NNNN` (contoh: `RTO-260305-0001`)
- Payment: `PMT-YYMMDD-NNNN` (semua jenis pembayaran: DP, harian, manual)

**Timezone — WIB (Asia/Jakarta):**
- Semua logika tanggal "hari ini" WAJIB menggunakan `getWibToday()` dari `PaymentService.ts`, BUKAN `new Date()`.
- Server production (Railway) berjalan di timezone UTC. `new Date()` memberikan tanggal UTC yang bisa beda hari dari WIB.
- Scheduler cron sudah di-set `timezone: 'Asia/Jakarta'` — ini hanya mengatur kapan cron trigger, tapi `new Date()` di dalamnya tetap UTC.
- `getWibToday()` menggunakan `toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })` untuk mendapatkan tanggal WIB yang benar.
- Timestamp seperti `createdAt`, `updatedAt`, `paidAt` tetap pakai `new Date()` (UTC) — tidak perlu WIB karena ini timestamp murni.

### Frontend Patterns (Detail)

**Tailwind CSS v4 (BUKAN v3):**
- Syntax: `@import "tailwindcss"`, `@theme inline`, `@custom-variant`
- JANGAN gunakan syntax v3 seperti `@tailwind base/components/utilities` atau `tailwind.config.js`

**ShadCN-style Components:**
- Semua UI components di `components/ui/` — ditulis manual, bukan install dari ShadCN registry.
- Artinya kita punya full control dan bisa modifikasi langsung.

**Data Fetching — SWR (WAJIB):**
- Semua API calls untuk read data WAJIB melalui SWR hooks di `hooks/useApi.ts`.
- JANGAN gunakan pattern `useState + useEffect + fetch` — ini sudah diganti semua ke SWR.
- Setelah mutasi (create/edit/delete), panggil `invalidate("/prefix")` dari `useInvalidate()` hook untuk refresh data.
- Contoh: setelah create customer → `invalidate("/customers", "/dashboard")`.
- TTL tiers sudah dikonfigurasi: LONG (10min), MEDIUM (5min), DEFAULT (1min), SHORT (15sec).

**Form Validation:**
- Gunakan React Hook Form + Zod resolver.
- Schemas ada di `lib/schemas.ts`. Jangan buat schema baru di file page.
- Untuk Select components dari Radix/ShadCN, gunakan `Controller` pattern (bukan `register`).

**State Management:**
- Zustand HANYA untuk auth store (`stores/authStore.ts`).
- Server state (data dari API) dikelola oleh SWR — jangan duplicate ke Zustand.

**UI Text — Bahasa Indonesia:**
- Semua text yang dilihat user harus Bahasa Indonesia.
- Contoh: "Tambah Customer", "Cari...", "Simpan", "Batal", "Hapus", "Tagihan", "Kontrak".
- Kecuali istilah teknis yang sudah umum: "Customer", "Contract", "Dashboard", "QR Code".

---

## Business Logic Rules (Detail)

### Down Payment (DP)

- Setiap kontrak baru WAJIB bayar DP sebelum unit motor bisa diterima.
- Nominal DP ditentukan oleh kombinasi motor + battery (lihat tabel di atas).
- **Skema pembayaran DP:**
  - `FULL`: 1 invoice (type=DP) dengan amount = full DP amount.
  - `INSTALLMENT`: 2 invoices (type=DP_INSTALLMENT). Cicilan 1 = `Math.ceil(dpAmount/2)`, cicilan 2 = `Math.floor(dpAmount/2)`.
- **Validasi penting:**
  - `receiveUnit()` HARUS cek `dpFullyPaid === true` sebelum proses.
  - BAST (Berita Acara Serah Terima): `bastPhoto` WAJIB diisi saat receive unit. `bastNotes` opsional.
  - Tagihan harian mulai H+1 setelah unit diterima (hari penerimaan = bebas tagihan).

### Payment Lifecycle (Unified PMT-xxx)

**Arsitektur**: Tidak ada lagi entitas Billing terpisah. Semua pembayaran (DP, harian, manual) menggunakan satu entitas Invoice/Payment dengan nomor PMT-xxx dan status PENDING/PAID/EXPIRED/VOID/FAILED.

**Flow normal (same-day model):**
1. Scheduler (00:01 WIB) generate Payment (PMT-xxx, status=PENDING) untuk **hari ini** untuk semua kontrak ACTIVE & OVERDUE
2. Customer bayar → status berubah dari PENDING ke PAID
3. PAID → credit hari ke contract (`totalDaysPaid++`, `ownershipProgress` update, `endDate` maju)

**Rollover mechanism:**
- Jika tagihan hari ini tidak dibayar, besok tagihan baru dibuat dengan akumulasi:
  - Hari ke-1: tagihan Rp 58.000 (1 hari, daysCount=1)
  - Hari ke-2 (belum bayar): tagihan lama expired, tagihan baru Rp 116.000 (daysCount=2)
  - Hari ke-3 (belum bayar): tagihan lama expired, tagihan baru Rp 174.000 (daysCount=3)
- Customer WAJIB bayar tagihan terbaru yang sudah akumulasi — tagihan lama sudah expired.

**Manual payment (1-7 hari):**
- Admin bisa buat tagihan manual untuk bayar beberapa hari sekaligus ke depan.
- Jika sudah ada tagihan aktif (PENDING): tagihan lama di-cancel, tagihan baru dibuat dengan merge (amount lama + baru).
- Tagihan merged punya `previousPaymentId` yang menunjuk ke tagihan sebelumnya.
- Jika tagihan merged di-cancel: tagihan sebelumnya di-reactivate (status → PENDING kembali).

**Field tambahan pada Invoice (Payment):**
- `dailyRate`: tarif harian saat tagihan dibuat
- `daysCount`: jumlah hari yang di-cover tagihan ini
- `periodStart`/`periodEnd`: periode tagihan
- `expiredAt`: kapan tagihan expired (untuk rollover)
- `previousPaymentId`: chain ke tagihan sebelumnya (rollover/merge)
- `isHoliday`: apakah tagihan ini untuk hari Libur Bayar

### Libur Bayar (Holiday System)

**Contract dibagi 2 tipe berdasarkan `holidayScheme` (enum `HolidayScheme`):**

- **`OLD_CONTRACT` (Kontrak Lama)**: Setiap hari **Minggu** di setiap bulan = Libur Bayar (semua Minggu, tanpa exception).
- **`NEW_CONTRACT` (Kontrak Baru)**: Customer hanya bayar tanggal **1-28** setiap bulan. Tanggal **29-31** = Libur Bayar.
  - Februari non-leap year: 28 hari, tidak ada libur.
  - Februari leap year: hanya 29 Feb yang libur.
  - Bulan 30 hari: 2 hari libur (29-30). Bulan 31 hari: 3 hari libur (29-31).

**Target Kepemilikan**: `ownershipTargetDays = 1278` **SUDAH TERMASUK** hari libur. Hari libur tetap credit ke `totalDaysPaid` (amount=0, auto-PAID).

**Tracking Hari di Contract** (3 field terpisah agar tidak rancu):
- `totalDaysPaid` = working + holiday (untuk progress calculation: `totalDaysPaid / 1278 * 100`)
- `workingDaysPaid` = jumlah hari kerja yang dibayar (ada uang masuk)
- `holidayDaysPaid` = jumlah hari libur yang di-credit gratis (amount=0)
- Invariant: `totalDaysPaid = workingDaysPaid + holidayDaysPaid`

**Logic `isLiburBayar(contract, date)`** di `PaymentService`:
- `OLD_CONTRACT`: `date.getDay() === 0` (Minggu)
- `NEW_CONTRACT`: `date.getDate() > 28` (tanggal 29-31)

**Tagihan di hari Libur Bayar**: amount Rp 0, status auto-PAID, isHoliday=true, tetap credit 1 hari ke ownership progress.
**endDate advancement**: saat credit hari kerja ke contract, skip hari Libur Bayar sesuai scheme.

### Contract Status Machine

**Valid transitions:**
```
ACTIVE → OVERDUE      (otomatis oleh scheduler saat grace period habis)
ACTIVE → COMPLETED    (otomatis saat totalDaysPaid >= ownershipTargetDays)
ACTIVE → CANCELLED    (manual oleh admin, butuh alasan)
ACTIVE → REPOSSESSED  (manual oleh admin, motor ditarik)
OVERDUE → ACTIVE      (otomatis saat customer bayar dan kembali current)
OVERDUE → REPOSSESSED (manual oleh admin)
OVERDUE → CANCELLED   (manual oleh admin)
```

**Terminal states (tidak bisa diubah lagi):**
- `COMPLETED` — customer sudah lunas ownership
- `CANCELLED` — kontrak dibatalkan, alasan di-append ke notes dengan prefix `[CANCELLED]`
- `REPOSSESSED` — motor ditarik, `repossessedAt` timestamp di-set

**Saat cancel/repossess:**
- Semua PENDING dan FAILED invoices otomatis di-void.
- Audit log dicatat.

### Payment Revert

- Admin bisa revert payment dari PAID atau VOID → kembali ke PENDING.
- **Jika revert dari PAID**: system otomatis undo perubahan contract:
  - DP payment: kurangi `dpPaidAmount`, set `dpFullyPaid = false` jika perlu
  - Daily payment: kurangi `totalDaysPaid`, recalculate `ownershipProgress`, mundurkan `endDate`
- Ini fitur koreksi admin — gunakan dengan hati-hati.

### Late Payment Penalty (Denda Keterlambatan)

**Setting (2 setting terpisah dari grace period OVERDUE):**

| Setting | Default | Deskripsi |
|---------|---------|-----------|
| `penalty_grace_days` | 2 | Toleransi (hari) sebelum denda berlaku |
| `late_fee_per_day` | 20.000 | Nominal denda per hari (Rp) |
| `grace_period_days` | 7 | Masa tenggang status OVERDUE (BUKAN untuk denda!) |

**PENTING**: `grace_period_days` hanya menentukan kapan kontrak berubah status ke OVERDUE (setelah endDate + N hari). `penalty_grace_days` menentukan kapan denda keterlambatan mulai berlaku. Kedua setting ini **independen** dan tidak boleh dicampur.

**Kebijakan denda:**
- **Kontrak lama (`OLD_CONTRACT` / holidayScheme Minggu) TIDAK dikenakan denda sama sekali.** Penalty hanya berlaku untuk `NEW_CONTRACT` dan kontrak-kontrak yang dibuat ke depannya.
- Denda dikenakan per hari yang telat bayar **>= penalty_grace_days** (default 2 hari)
- **Rumus**: hari kena denda jika `(today - tanggalHari) >= penalty_grace_days`

**Contoh** (EdPower 83k, today=10, terakhir bayar=4):
- Hari 5-8 kena denda (diff 5,4,3,2 ≥ 2). Hari 9-10 tidak (diff 1,0 < 2).
- Bayar hari 5: 83k + 20k = 103k
- Bayar hari 6-7: (83k+20k)×2 = 206k
- Bayar hari 8-10: (83k+20k) + 83k×2 = 269k

**Implementasi:**
- Pure function `computeLateFee()` di `domain/utils/lateFeeCalculator.ts` — shared oleh PaymentService & ContractService
- `PaymentService.calculateLateFee()` adalah async wrapper yang baca setting lalu panggil `computeLateFee()`
- `Invoice.lateFee` field menyimpan total denda (terpisah dari `amount`)
- Total bayar = `amount + lateFee`
- Berlaku untuk: daily billing (scheduler), manual payment, rollover, reduce payment, extension
- Holiday (amount=0) **tidak kena denda**

**Migrasi setting:**
- `SettingService.seedDefaults()` punya `migrateSettings()` yang otomatis update setting lama ke nilai baru jika belum pernah dikustomisasi admin. Ini memastikan deploy ke environment lama tidak butuh manual SQL update.

### Payment Calendar (Warna)

| Warna | Status | Keterangan |
|-------|--------|------------|
| Hijau | `paid` | Hari yang sudah dibayar |
| Kuning | `pending` | Ada tagihan aktif, belum dibayar (hari ini atau mendatang) |
| Merah | `overdue` | Tanggal yang sudah lewat dalam tagihan aktif (tunggakan) |
| Biru | `holiday` | Libur Bayar (Minggu yang designated) |
| Abu-abu | `not_issued` | Tagihan belum diterbitkan untuk tanggal ini |

---

## Database & Seed

### Prisma

- Schema: `packages/backend/prisma/schema.prisma`
- 6 models: User, Customer, Contract, Invoice, AuditLog, Setting
- 10 enums: MotorModel, BatteryType, ContractStatus, PaymentStatus, InvoiceType, DPScheme, HolidayScheme, Gender, AuditAction, UserRole
- Column naming: snake_case via `@map`/`@@map` (field names tetap camelCase di TypeScript)
- Client singleton: `packages/backend/src/infrastructure/prisma/client.ts`

### Seed Script

**File utama:** `packages/backend/prisma/seed.ts`

**Data source:** Static TypeScript files (bukan CSV, bukan runtime parsing):
- `packages/backend/prisma/data/customers.ts` — 80 customers, interface `CustomerSeed`
- `packages/backend/prisma/data/contracts.ts` — 79 contracts, interface `ContractSeed`, type `DateTuple = [year, month, day]`

**Commands:**
```bash
# Development: insert data jika belum ada, skip jika sudah ada
cd packages/backend && npx prisma db seed

# Development: hapus semua data dan insert ulang dari awal
cd packages/backend && npx prisma db seed -- --reset

# Production: --reset DITOLAK tanpa --force (safety guard)
cd packages/backend && npx prisma db seed -- --reset --force
```

**Behavior idempotent:**
- Admin user dan settings: `upsert` — aman dijalankan berulang kali.
- Customer: cek KTP number, skip duplikat.
- Contract: cek `contract.count()`, skip semua jika sudah ada data.
- Tanpa `--reset`: TIDAK menghapus data apapun.

**Menambah data seeding baru:**
1. Edit file `.ts` di `prisma/data/` — ikuti interface yang ada.
2. Format tanggal customers: ISO string `"2001-08-25"` (birth date).
3. Format tanggal contracts: tuple `[year, month, day]` → contoh: `[2025, 12, 30]` = 30 Desember 2025. **Bulan 1-indexed** (1=Januari, bukan 0).
4. `totalDaysPaid: null` = unit belum diterima (belum ada billing history).
5. Deploy dan jalankan `--reset --force` di server jika data lama perlu diganti.

### Railway Deployment

- `railway.json` startCommand: `prisma db push → prisma db seed → node dist/index.js`
- Seed jalan otomatis setiap deploy tapi idempotent (skip jika data sudah ada).
- Reset data di production HANYA bisa via manual command dengan `--reset --force`.

---

## Testing

- Framework: Jest + ts-jest
- Lokasi: `packages/backend/src/__tests__/`
- 5 test suites: AuthService, CustomerService, ContractService, PaymentService, SavingService
- **198 tests** saat ini
- Semua tests menggunakan InMemory repositories — TIDAK butuh PostgreSQL.
- Jalankan: `cd packages/backend && npm test`
- Saat menambah fitur baru, WAJIB tambah/update tests yang relevan.

---

## Development Commands

```bash
# === Development ===
npm run dev                  # Start frontend (3000) + backend (3001)
npm run dev:backend          # Backend only
npm run dev:frontend         # Frontend only

# === Testing ===
cd packages/backend && npm test              # Run all tests
cd packages/backend && npx tsc --noEmit      # TypeScript check backend
cd packages/frontend && npx tsc --noEmit     # TypeScript check frontend

# === Build ===
cd packages/backend && npm run build         # prisma generate + tsc
cd packages/frontend && npm run build        # Next.js build

# === Database ===
cd packages/backend && npx prisma db push    # Sync schema ke database
cd packages/backend && npx prisma db seed    # Seed data (idempotent)
cd packages/backend && npx prisma studio     # GUI database browser
```

## Credentials & URLs

- Admin login: `admin` / `admin123`
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api

---

## Git & Deployment

**Branching strategy:**
```
develop/* ──PR──> staging ──PR──> main (production)
hotfix/*  ──PR──> main (+ backmerge ke staging)
chore/*   ──PR──> staging atau main
```

- **CI**: GitHub Actions — triggered on PR to main/staging. Steps: install, prisma generate, tsc, jest, build.
- **Branch protection**: main + staging require PR + CI pass. No direct push.
- **Backend deployment**: Railway (PostgreSQL addon auto-provides `DATABASE_URL`)
- **Frontend deployment**: Vercel (set `NEXT_PUBLIC_API_URL` env var)

---

## Development Roadmap (Current Status)

| Phase | Status | Deskripsi Singkat |
|-------|--------|-------------------|
| 1-2 | COMPLETE | Foundation, testing (52 tests), detail pages |
| 3 | COMPLETE | Core RTO: ownership, extension, repossession, grace period |
| 4 | COMPLETE | Admin controls: edit, cancel, void, mark-paid, soft delete |
| 5 | COMPLETE | Financial: late fee, reports, PDF invoice, exports |
| 5.5 | COMPLETE | Business logic audit: settings-driven, payment-gated, state machine |
| 6 | COMPLETE | UX: pagination, charts (Recharts), forms (RHF+Zod), skeleton, command palette |
| 6.5 MP-6A~6G | COMPLETE | RTO overhaul: DP, billing lifecycle, rollover, Libur Bayar, frontend |
| 6.5 MP-6D | PENDING | DOKU Payment Gateway integration |
| 6.5 MP-6E | PENDING | WhatsApp Reminder (depends on DOKU) |
| 6.5 MP-6H | PENDING | Frontend Payment Gateway UI |
| 6.5 MP-6I | PENDING | Comprehensive seed data & test update |
| 7 | PENDING | Security: JWT + bcrypt, RBAC (SUPER_ADMIN/ADMIN/VIEWER), user management |
| 8 | COMPLETE | PostgreSQL + Prisma migration (7 Prisma repos, conditional init) |
| 9 | IN PROGRESS | Deployment: CI done, Railway + Vercel pending |

Detail lengkap setiap phase ada di `docs/CHANGELOG.md`.
