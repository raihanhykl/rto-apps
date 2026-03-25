# CLAUDE.md — Infrastructure Layer

> Instruksi untuk `packages/backend/src/infrastructure/`.
> Layer ini berisi implementasi konkret dari repository interfaces, scheduler, middleware, dan config.

---

## Aturan Infrastructure Layer

- Boleh import dari Domain dan Application layer.
- TIDAK BOLEH import dari Presentation layer (`src/presentation/`).
- Infrastructure adalah "penghubung" antara business logic dan dunia luar (DB, file system, scheduler).

---

## Struktur Infrastructure Layer

```
src/infrastructure/
├── repositories/    # InMemory* + Prisma* implementations
├── prisma/          # Prisma client singleton
├── middleware/      # Auth middleware, error handler
├── config/          # App configuration
├── scheduler/       # node-cron jobs
├── swagger.ts       # Swagger/OpenAPI setup
└── sentry.ts        # Sentry error monitoring
```

---

## Repository Implementations

### Dua Implementasi Wajib

Setiap repository interface HARUS punya dua implementasi:

**1. `InMemory*Repository`** (Map-based):

- Digunakan untuk development dan unit testing.
- Data tersimpan di Map dalam memory — hilang saat restart.
- Jangan pakai `async/await` yang tidak perlu (boleh return `Promise.resolve()`).
- Contoh: `InMemoryContractRepository.ts`

**2. `Prisma*Repository`** (PostgreSQL):

- Digunakan di production (`DATABASE_URL` env var tersedia).
- Semua query via Prisma Client.
- Gunakan `prisma.model.findMany({ where: { isDeleted: false } })` untuk soft delete filter.
- Contoh: `PrismaContractRepository.ts`

### Conditional Initialization

Di `src/index.ts`:

```typescript
const contractRepo = process.env.DATABASE_URL
  ? new PrismaContractRepository(prisma)
  : new InMemoryContractRepository();
```

### Rules Saat Update Repository

- **Menambah method baru** di interface → WAJIB implementasikan di KEDUA varian.
- **InMemory**: Gunakan Map operations (get, set, delete, Array.from values).
- **Prisma**: Gunakan Prisma query builder — hindari raw SQL kecuali benar-benar perlu.
- **Soft delete filter**: Semua `findAll/findMany/count` HARUS include `where: { isDeleted: false }`.

---

## Prisma Client Singleton

- Lokasi: `src/infrastructure/prisma/client.ts`
- Gunakan **singleton pattern** — satu instance per process.
- JANGAN buat `new PrismaClient()` di tempat lain selain file ini.

```typescript
// Penggunaan yang benar:
import { prisma } from '../prisma/client';
```

---

## Scheduler (node-cron)

- Lokasi: `src/infrastructure/scheduler/` atau terintegrasi di service.
- **Timezone wajib**: `{ timezone: 'Asia/Jakarta' }` di setiap cron job.
- Scheduler berjalan **00:01 WIB** untuk generate daily payments.
- Meski `timezone` di-set, `new Date()` di dalam callback tetap UTC → gunakan `getWibToday()` dari PaymentService.

```typescript
// Contoh cron setup:
cron.schedule(
  '1 0 * * *',
  async () => {
    const today = getWibToday(); // WAJIB, bukan new Date()
    await paymentService.generateDailyPayments(today);
  },
  { timezone: 'Asia/Jakarta' },
);
```

**Jobs yang berjalan:**

- `00:01 WIB` — `generateDailyPayments()`: generate invoice + PaymentDay untuk semua kontrak ACTIVE & OVERDUE
- Scheduler juga handle rollover: expire tagihan lama, buat tagihan baru dengan akumulasi

---

## Middleware

### Auth Middleware

- Lokasi: `src/infrastructure/middleware/auth.ts`
- Validasi token di setiap request protected.
- Token sederhana (Phase 7 akan upgrade ke JWT + bcrypt).
- Attach `userId` ke `req` object setelah validasi.

### Error Handler

- Lokasi: `src/infrastructure/middleware/errorHandler.ts`
- Global error handler untuk Express.
- Catch semua uncaught errors, format response konsisten.
- Sentry integration di sini untuk capture errors.

---

## Sentry

- Config: `src/infrastructure/sentry.ts`
- Inisialisasi di `src/index.ts` sebelum routes.
- Perlu `SENTRY_DSN` env var — tanpa ini, Sentry tidak aktif (graceful).
- Gunakan `Sentry.captureException(error)` untuk error yang perlu dilacak.

---

## Swagger/OpenAPI

- Config: `src/infrastructure/swagger.ts`
- Tersedia di `http://localhost:3001/api-docs`.
- Update Swagger spec saat menambah endpoint baru.
- Gunakan JSDoc annotations di route files untuk auto-generate spec.
