# CLAUDE.md — Backend Package

> Instruksi spesifik untuk `packages/backend/`.
> Dibaca bersama root `CLAUDE.md` yang berisi instruksi global.
>
> **Sub-CLAUDE.md di backend:**
>
> - `src/domain/CLAUDE.md` — Domain layer purity rules
> - `src/application/CLAUDE.md` — Business logic detail, service patterns
> - `src/infrastructure/CLAUDE.md` — Repository implementations, scheduler
> - `src/__tests__/CLAUDE.md` — Unit testing rules
> - `prisma/CLAUDE.md` — Schema, seed, migrations

---

## Tech Stack Backend

- **Runtime**: Node.js + TypeScript (strict mode)
- **Framework**: Express.js
- **ORM**: Prisma v6 (PostgreSQL production, InMemory dev/test)
- **Validation**: Zod
- **Scheduler**: node-cron (`timezone: 'Asia/Jakarta'`)
- **Testing**: Jest + ts-jest (InMemory repositories, no DB needed)
- **API Docs**: Swagger/OpenAPI di `http://localhost:3001/api-docs`
- **Monitoring**: Sentry (needs `SENTRY_DSN` env var)

---

## Clean Architecture — Layer Dependency

```
Domain (paling dalam)
  ↓ hanya boleh diimport oleh ↓
Application (business logic + DTOs)
  ↓ hanya boleh diimport oleh ↓
Infrastructure (repositories, scheduler, middleware)
  ↓ hanya boleh diimport oleh ↓
Presentation (controllers, routes)
```

### Aturan Import WAJIB

| Layer          | Path                  | Boleh Import Dari        | TIDAK BOLEH Import Dari         |
| -------------- | --------------------- | ------------------------ | ------------------------------- |
| Domain         | `src/domain/`         | Tidak ada (paling murni) | Semua layer lain                |
| Application    | `src/application/`    | Domain saja              | Infrastructure, Presentation    |
| Infrastructure | `src/infrastructure/` | Domain + Application     | Presentation                    |
| Presentation   | `src/presentation/`   | Application saja         | Domain langsung, Infrastructure |

### Implikasi Praktis

- Menambah entity baru → `domain/entities/` + interface di `domain/interfaces/`
- Menambah business logic → service di `application/services/`
- Menambah database query → `infrastructure/repositories/` (KEDUA varian: InMemory + Prisma)
- Menambah API endpoint → controller di `presentation/controllers/` + route di `presentation/routes/`
- Controller TIDAK boleh berisi business logic — hanya parse request, panggil service, return response

---

## Repository Pattern (WAJIB)

- Semua data access WAJIB melalui repository **interfaces** (`ICustomerRepository`, `IContractRepository`, dll.).
- **Dua implementasi wajib** per interface:
  - `InMemory*Repository` — Map-based, untuk dev/test
  - `Prisma*Repository` — PostgreSQL, untuk production
- Conditional initialization di `src/index.ts`: `DATABASE_URL` ada → Prisma, tidak ada → InMemory.
- **Saat menambah method baru di repository interface: HARUS update KEDUA implementasi.**

---

## DTO Validation

- Semua input dari API di-validate menggunakan **Zod schemas** di `application/dtos/index.ts`.
- Validasi dilakukan di **service**, bukan di controller.
- Jangan buat schema baru di tempat lain — semua schema di `application/dtos/index.ts`.

---

## Audit Logging (WAJIB)

- Setiap operasi mutasi (create, update, delete, payment) WAJIB dicatat ke AuditLog.
- Format: `{ userId, action, module, entityId, description, metadata }`.
- Tersedia action enum: `AuditAction` di `domain/enums/`.
- **Jangan lupa audit log saat menambah fitur baru yang mengubah data.**

---

## Soft Delete

- Customer dan Contract menggunakan soft delete (`isDeleted: boolean`, `deletedAt: DateTime?`).
- Semua query `findAll`, `search`, `count` HARUS filter `isDeleted: false` secara default.
- Hard delete TIDAK digunakan di project ini.

---

## Sequential Numbering

- Contract: `RTO-YYMMDD-NNNN` (contoh: `RTO-260305-0001`)
- Payment/Invoice: `PMT-YYMMDD-NNNN` (semua jenis: DP, harian, manual)
- Nomor digenerate di service, bukan di controller.

---

## Timezone — WIB (Asia/Jakarta) — KRITIKAL

- **WAJIB** gunakan `getWibToday()` dari `PaymentService.ts` untuk logika "hari ini".
- **JANGAN** pakai `new Date()` untuk menentukan tanggal hari ini — server Railway berjalan UTC.
- `getWibToday()` menggunakan `toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })`.
- Scheduler cron di-set `timezone: 'Asia/Jakarta'` — hanya mengatur kapan trigger, bukan timezone `new Date()`.
- Timestamp murni (`createdAt`, `updatedAt`, `paidAt`) → tetap pakai `new Date()` (UTC), tidak perlu WIB.

---

## Backend Dev Commands

```bash
# Development
npm run dev:backend                      # Start backend (port 3001)

# Build & Type Check
cd packages/backend && npm run build     # prisma generate + tsc
cd packages/backend && npx tsc --noEmit  # TypeScript check saja

# Testing
cd packages/backend && npm test          # Run all 200 unit tests (Jest)
cd packages/backend && npm test -- --watch   # Watch mode
cd packages/backend && npm test -- --coverage  # Coverage report

# Linting
npm run lint:backend                     # ESLint backend
npm run format                           # Prettier semua file

# Prisma (lihat prisma/CLAUDE.md untuk detail)
cd packages/backend && npx prisma studio         # GUI database browser
cd packages/backend && npx prisma db seed        # Seed data
cd packages/backend && npx prisma migrate dev --name nama  # Buat migration baru
```

---

## TypeScript Conventions

- Strict mode aktif — tidak ada `any` tanpa alasan kuat.
- Selalu gunakan explicit return types untuk public methods di services.
- Enums di `domain/enums/` — jangan buat enum di layer lain.
- Interface untuk entities dan repository contracts di `domain/interfaces/` dan `domain/entities/`.
- Utility functions di `domain/utils/` (murni, tanpa side effects).
