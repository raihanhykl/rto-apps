# CLAUDE.md — Root Instructions

> Instruksi global yang berlaku di seluruh project WEDISON RTO Apps.
> File ini di-load otomatis setiap sesi bersama dengan CLAUDE.md di sub-direktori yang relevan.
>
> **Peta CLAUDE.md di project ini:**
>
> - `CLAUDE.md` (ini) — Instruksi global, project identity, business rules, git
> - `packages/backend/CLAUDE.md` — Backend overview, commands, clean architecture
> - `packages/backend/src/domain/CLAUDE.md` — Domain layer purity rules
> - `packages/backend/src/application/CLAUDE.md` — Business logic detail, services
> - `packages/backend/src/infrastructure/CLAUDE.md` — Repositories, scheduler, middleware
> - `packages/backend/src/__tests__/CLAUDE.md` — Unit testing rules
> - `packages/backend/prisma/CLAUDE.md` — Prisma schema, seed, migrations
> - `packages/frontend/CLAUDE.md` — Frontend patterns, Tailwind v4, SWR, forms
> - `packages/frontend/e2e/CLAUDE.md` — E2E testing rules
>
> **File dokumentasi terkait:**
>
> - `README.md` — Tech stack, API endpoints, architecture, cara setup
> - `docs/CHANGELOG.md` — History lengkap semua perubahan per phase

---

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
- `superpowers-subagent-driven-development` — saat ada multiple independent tasks
- `superpowers-finishing-a-development-branch` — saat implementasi selesai

---

## Bahasa Komunikasi

**Claude WAJIB selalu berkomunikasi dalam Bahasa Indonesia dengan user.** Semua penjelasan, pertanyaan, summary, dan output teks harus dalam Bahasa Indonesia. Kecuali untuk:

- Kode program (tetap dalam bahasa Inggris)
- Istilah teknis yang sudah umum (commit message, variable name, error message, dll.)
- Nama file, path, dan command terminal

---

## Documentation Rules (WAJIB DIIKUTI)

Claude WAJIB mencatat setiap perubahan signifikan ke file yang tepat:

| Jenis Perubahan                                         | Catat Di                   | Contoh                                |
| ------------------------------------------------------- | -------------------------- | ------------------------------------- |
| Aturan/instruksi baru untuk Claude                      | CLAUDE.md yang relevan     | "Selalu gunakan upsert untuk seeding" |
| Perubahan tech stack, API endpoint, architecture, setup | `README.md`                | Tambah endpoint baru, ubah port       |
| Fitur baru, bug fix, refactor, perubahan kode apapun    | `docs/CHANGELOG.md`        | "Phase 7: JWT Authentication"         |
| Pattern/konvensi yang dipelajari dari interaksi         | `.claude/memory/MEMORY.md` | "User prefer Indonesian UI text"      |

### Aturan Pencatatan

1. Setelah perubahan kode signifikan, LANGSUNG update file dokumentasi yang relevan.
2. Jika context window mendekati penuh, PRIORITASKAN mencatat semua perubahan sebelum sesi berakhir.
3. Jangan duplikasi informasi antar file.
4. Saat menambah API endpoint baru → update tabel API di `README.md`.
5. Saat ada keputusan arsitektur atau business rule baru → update CLAUDE.md yang relevan.
6. Format changelog entry: tanggal, judul, context, what was changed, files modified, test count.
7. Perubahan kecil (fix typo, adjust padding) — tidak perlu dicatat.

---

## Project Identity

- **Company**: WEDISON — perusahaan motor listrik (electric motorcycle)
- **System**: Internal RTO (Rent To Own) Management System
- **Users**: Hanya admin internal WEDISON. Tidak ada login untuk customer/end-user.
- **Bahasa UI**: Bahasa Indonesia untuk semua text yang dilihat user (button, heading, placeholder, toast, dialog, dll.)

### Motor Models & Pricing

| Motor + Battery                | Daily Rate     | DP Amount  |
| ------------------------------ | -------------- | ---------- |
| Athena Regular Battery         | Rp 58.000/hari | Rp 530.000 |
| Athena Extended Battery        | Rp 63.000/hari | Rp 580.000 |
| Victory Regular Battery        | Rp 58.000/hari | Rp 530.000 |
| Victory Extended Battery       | Rp 63.000/hari | Rp 580.000 |
| EdPower (hanya 1 tipe baterai) | Rp 83.000/hari | Rp 780.000 |

- **Ownership Target**: 1.278 hari (`ownershipTargetDays = 1278`) — **SUDAH TERMASUK** hari libur
- **Payment Model**: Same-day — tagihan (PMT-xxx) di-generate jam 00:01 WIB untuk hari itu juga
- **Manual Payment**: Admin bisa buat tagihan manual 1-7 hari ke depan

---

## Business Rules Summary

> Detail implementasi ada di `packages/backend/src/application/CLAUDE.md`.
> Berikut ringkasan yang perlu diketahui di semua context:

### Down Payment (DP)

- Setiap kontrak baru WAJIB bayar DP sebelum unit motor bisa diterima.
- Skema: `FULL` (1 invoice) atau `INSTALLMENT` (2 invoices: ceil/floor dari dpAmount/2).
- `receiveUnit()` WAJIB cek `dpFullyPaid === true`. BAST photo wajib.
- Tagihan harian mulai H+1 setelah unit diterima.

### Libur Bayar (Holiday System)

- `OLD_CONTRACT`: Setiap hari **Minggu** = Libur Bayar.
- `NEW_CONTRACT`: Tanggal **29-31** setiap bulan = Libur Bayar.
- Hari libur: amount=0, auto-PAID, tetap credit 1 hari ke ownership progress.
- Contract tracking: `totalDaysPaid = workingDaysPaid + holidayDaysPaid` (3 field terpisah).

### Contract Status

```
ACTIVE → OVERDUE → ACTIVE (otomatis, bayar)
ACTIVE/OVERDUE → COMPLETED/CANCELLED/REPOSSESSED (terminal)
```

Saat cancel/repossess: semua PENDING/FAILED invoices otomatis di-void.

### Late Payment Penalty

- **Hanya `NEW_CONTRACT`** yang kena denda. `OLD_CONTRACT` bebas denda.
- 2 setting terpisah (JANGAN dicampur):
  - `penalty_grace_days` (default 2) — toleransi sebelum denda berlaku
  - `grace_period_days` (default 7) — masa tenggang status OVERDUE (BUKAN untuk denda!)
- `late_fee_per_day` (default Rp 20.000/hari). Total bayar = `amount + lateFee`.

---

## Credentials & URLs

- Admin login: `admin` / `admin123`
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- API Docs (Swagger): http://localhost:3001/api-docs

---

## Development Commands (Root)

```bash
# Start semua
npm run dev                  # Frontend (3000) + Backend (3001)
npm run dev:backend          # Backend only
npm run dev:frontend         # Frontend only

# Linting & Formatting (root-level, semua packages)
npm run lint:backend
npm run lint:frontend
npm run format               # Prettier semua file
npm run format:check
```

---

## Git & Deployment

```
develop/* ──PR──> staging ──PR──> main (production)
hotfix/*  ──PR──> main (+ backmerge ke staging)
chore/*   ──PR──> staging atau main
```

- **CI**: GitHub Actions — lint, test, e2e (e2e hanya untuk PR ke main)
- **Branch protection**: main + staging require PR + CI pass. No direct push.
- **Backend**: Railway (PostgreSQL addon auto-provides `DATABASE_URL`)
- **Frontend**: Vercel (set `NEXT_PUBLIC_API_URL` env var)

---

## Development Roadmap

| Phase        | Status      | Deskripsi Singkat                                                             |
| ------------ | ----------- | ----------------------------------------------------------------------------- |
| 1-2          | COMPLETE    | Foundation, testing (52 tests), detail pages                                  |
| 3            | COMPLETE    | Core RTO: ownership, extension, repossession, grace period                    |
| 4            | COMPLETE    | Admin controls: edit, cancel, void, mark-paid, soft delete                    |
| 5            | COMPLETE    | Financial: late fee, reports, PDF invoice, exports                            |
| 5.5          | COMPLETE    | Business logic audit: settings-driven, payment-gated, state machine           |
| 6            | COMPLETE    | UX: pagination, charts (Recharts), forms (RHF+Zod), skeleton, command palette |
| 6.5 MP-6A~6G | COMPLETE    | RTO overhaul: DP, billing lifecycle, rollover, Libur Bayar, frontend          |
| 6.5 MP-6D    | PENDING     | DOKU Payment Gateway integration                                              |
| 6.5 MP-6E    | PENDING     | WhatsApp Reminder (depends on DOKU)                                           |
| 6.5 MP-6H    | PENDING     | Frontend Payment Gateway UI                                                   |
| 6.5 MP-6I    | PENDING     | Comprehensive seed data & test update                                         |
| 7            | PENDING     | Security: JWT + bcrypt, RBAC (SUPER_ADMIN/ADMIN/VIEWER), user management      |
| 8            | COMPLETE    | PostgreSQL + Prisma migration (7 Prisma repos, conditional init)              |
| 9            | IN PROGRESS | Deployment: CI done, Railway + Vercel pending                                 |

Detail lengkap setiap phase ada di `docs/CHANGELOG.md`.
