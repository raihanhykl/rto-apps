# Remaining Medium Fixes — M5, M6, M11

> **Planning document untuk dedicated session.**
> Tiga item kecil dan low-risk yang bisa diselesaikan dalam ~1 jam.

---

## Background & Context

### Project Overview

WEDISON RTO — Internal Rent-To-Own management system untuk motor listrik. Monorepo: `packages/backend` (Express + TypeScript, Clean Architecture) dan `packages/frontend` (Next.js 16).

### Audit Progress

Audit robustness & scalability menghasilkan 42 temuan. **Wave 1-4 sudah selesai dan verified** (234 unit tests pass, 0 TS errors). Tiga item MEDIUM tersisa yang belum dikerjakan — semua kecil, isolated, dan low-risk.

### Yang Sudah Dikerjakan (Jangan Ulangi!)

- Wave 1: Rate limiting, helmet, health check, indexes, query validation, error boundary, scheduler isolation
- Wave 2: SequenceGenerator, atomic saving balance
- Wave 3: Aggregate queries, paginated endpoints, N+1 fix, frontend unbounded fetches
- Wave 4: Env validation, structured logging, graceful shutdown, advisory lock, connection pooling
- M1-M4, M9-M10, M12-M14: Semua sudah selesai

### Branch

Kerjakan di branch aktif atau buat branch `chore/remaining-medium-fixes`.

---

## Constraint (WAJIB)

1. **TIDAK mengubah business logic** — semua fix bersifat infrastruktur
2. **Semua 234 test HARUS pass** setelah setiap perubahan
3. **InMemory repository tetap konsisten**
4. **Satu commit per item** — mudah revert

---

## M5 — Repository update() Swallows Errors

### Problem

Semua Prisma repository `update()` methods punya `catch { return null }` yang menelan error. Caller tidak tahu apakah update gagal karena record not found atau karena database error (connection lost, constraint violation).

### Lokasi (Confirmed)

| File                            | Method                      | Line      |
| ------------------------------- | --------------------------- | --------- |
| `PrismaContractRepository.ts`   | `update()`                  | ~L155-166 |
| `PrismaContractRepository.ts`   | `delete()`                  | ~L168-175 |
| `PrismaCustomerRepository.ts`   | `update()`                  | ~L117-128 |
| `PrismaCustomerRepository.ts`   | `delete()`                  | ~L130-137 |
| `PrismaInvoiceRepository.ts`    | `update()`                  | ~L193-204 |
| `PrismaInvoiceRepository.ts`    | `delete()`                  | ~L206-213 |
| `PrismaUserRepository.ts`       | `update()`                  | ~L43-54   |
| `PrismaUserRepository.ts`       | `delete()`                  | ~L56-63   |
| `PrismaPaymentDayRepository.ts` | `update()`                  | ~L124-135 |
| `PrismaPaymentDayRepository.ts` | `updateByContractAndDate()` | ~L137-156 |
| `PrismaSettingRepository.ts`    | `delete()`                  | ~L32-39   |

### Fix Approach

**Differentiate "not found" dari "real error":**

```typescript
// BEFORE (error swallowing):
async update(id: string, data: Partial<Contract>): Promise<Contract | null> {
  try {
    const updated = await this.prisma.contract.update({
      where: { id },
      data,
    });
    return this.toEntity(updated);
  } catch {
    return null;  // ← Swallows ALL errors
  }
}

// AFTER (only catch "not found"):
async update(id: string, data: Partial<Contract>): Promise<Contract | null> {
  try {
    const updated = await this.prisma.contract.update({
      where: { id },
      data,
    });
    return this.toEntity(updated);
  } catch (error: unknown) {
    // Prisma P2025 = "Record not found" → return null (expected)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as any).code === 'P2025'
    ) {
      return null;
    }
    // All other errors (connection, constraint, etc.) → throw
    throw error;
  }
}
```

**Pattern Prisma error codes:**

- `P2025` — "An operation failed because it depends on one or more records that were required but not found."
- Ini satu-satunya error yang boleh return `null`. Semua lainnya harus di-throw.

### Catatan

- `atomicDecrementSavingBalance()` di PrismaContractRepository juga catch error — tapi ini intentional karena return `null` berarti "insufficient balance" (bisa P2025 atau constraint). **Jangan ubah yang ini.**
- InMemory repositories tidak perlu diubah — mereka sudah handle "not found" secara eksplisit dengan Map.get().
- Test impact: **minimal** — unit tests pakai InMemory repos, bukan Prisma repos.

---

## M6 — PrismaContractRepository.findAll() Missing isDeleted Filter

### Problem

`PrismaContractRepository.findAll()` tidak filter `isDeleted: false`, padahal semua method lain (`findAllPaginated`, `findByCustomerId`, `findByStatus`, `findFiltered`) sudah filter.

### Lokasi

**File**: `packages/backend/src/infrastructure/repositories/PrismaContractRepository.ts`

```typescript
// Line 14-20 — MISSING isDeleted filter
async findAll(): Promise<Contract[]> {
  const rows = await this.prisma.contract.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => this.toEntity(r));
}
```

**Bandingkan dengan findAllPaginated() (sudah benar):**

```typescript
async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Contract>> {
  const where: Prisma.ContractWhereInput = { isDeleted: false };  // ← BENAR
  // ...
}
```

### Fix

```typescript
async findAll(): Promise<Contract[]> {
  const rows = await this.prisma.contract.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => this.toEntity(r));
}
```

### Catatan

- InMemoryContractRepository: cek apakah `findAll()` juga filter `isDeleted`. Jika tidak, tambahkan juga agar konsisten.
- `PrismaCustomerRepository.findAll()` (L13-19) **sudah** filter `isDeleted: false` — jadi ini memang inkonsistensi yang perlu diperbaiki.
- **Potential impact**: Jika ada soft-deleted contracts di production, mereka akan hilang dari `findAll()` results setelah fix. Ini BENAR (expected behavior).

---

## M11 — CORS Wildcard Validation

### Problem

`CORS_ORIGIN` env var diterima sebagai string tanpa validasi. Jika di-set ke `*`, cors() akan accept all origins — dangerous terutama saat `credentials: true`.

### Lokasi

**File**: `packages/backend/src/infrastructure/config/index.ts`

```typescript
// Line 15 — No format validation
CORS_ORIGIN: z.string().optional().default('http://localhost:3000'),
```

**File**: `packages/backend/src/index.ts`

```typescript
// Line 77 — Raw value passed to cors()
app.use(cors({ origin: config.corsOrigin, credentials: true }));
```

### Fix Approach

**Option A (Simple — Recommended)**: Validate di config, reject wildcard di production.

```typescript
// config/index.ts
const envSchema = z.object({
  // ... existing ...
  CORS_ORIGIN: z
    .string()
    .optional()
    .default('http://localhost:3000')
    .refine(
      (val) => {
        // Block wildcard in production
        if (process.env.NODE_ENV === 'production' && val === '*') {
          return false;
        }
        return true;
      },
      { message: 'CORS_ORIGIN cannot be wildcard (*) in production' },
    ),
});
```

**Option B (Stricter)**: Validate URL format.

```typescript
CORS_ORIGIN: z
  .string()
  .optional()
  .default('http://localhost:3000')
  .refine(
    (val) => {
      if (val === '*') {
        return process.env.NODE_ENV !== 'production';
      }
      // Must be valid URL(s) — support comma-separated
      return val.split(',').every((origin) => {
        try {
          new URL(origin.trim());
          return true;
        } catch {
          return false;
        }
      });
    },
    { message: 'CORS_ORIGIN must be valid URL(s) or "*" (dev only)' }
  ),
```

**Rekomendasi**: Option A — simple, focused, mencegah masalah utama (wildcard di production).

### Catatan

- Frontend Vercel akan set `CORS_ORIGIN` ke production URL (e.g., `https://rto.wedison.com`)
- Development boleh wildcard — ini convenience, bukan security concern di localhost
- Comma-separated origins: cors() package support array — bisa split dan pass `origin: config.corsOrigin.split(',')` jika perlu

---

## Verification

Setelah ketiga fix:

```bash
cd packages/backend && npx tsc --noEmit    # 0 errors
cd packages/backend && npm test            # 234/234 pass
npm run lint:backend                       # no new warnings
```

### Per-Item Verification

| Item | How to Verify                                                                           |
| ---- | --------------------------------------------------------------------------------------- |
| M5   | Check Prisma repo files — no more bare `catch { return null }` (except atomicDecrement) |
| M6   | Check `findAll()` has `where: { isDeleted: false }`                                     |
| M11  | Set `CORS_ORIGIN=*` + `NODE_ENV=production` → server should crash on startup            |

---

## Estimated Time

- M5: ~30 menit (11 methods across 6 files, same pattern)
- M6: ~5 menit (1 line change + check InMemory consistency)
- M11: ~10 menit (1 Zod refine)
- Verification: ~5 menit
- **Total: ~50 menit**
