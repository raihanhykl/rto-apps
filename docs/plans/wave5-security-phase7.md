# Wave 5 — Security Overhaul (Phase 7)

> **Planning document untuk dedicated session.**
> Semua item ini saling terkait dan harus dikerjakan sebagai satu kesatuan.

---

## Background & Context

### Project Overview

WEDISON RTO — Internal Rent-To-Own management system untuk motor listrik. Monorepo: `packages/backend` (Express + TypeScript, Clean Architecture) dan `packages/frontend` (Next.js 16).

### Audit Progress

Audit robustness & scalability menghasilkan 42 temuan. **Wave 1-4 sudah selesai dan verified** (234 unit tests pass, 0 TS errors). Wave 5 items di-SKIP karena saling terkait dan sudah planned untuk Phase 7.

### Yang Sudah Ada (Jangan Rusak!)

- Rate limiting: global 300 req/15min + login 10 req/15min
- Helmet security headers aktif
- Zod env var validation (crash early in production)
- PostgreSQL advisory lock di scheduler
- Structured JSON logging di error handler
- Graceful shutdown (Prisma disconnect + scheduler stop)

### Branch

Buat branch baru: `develop/phase7-security` dari `main` atau `staging`.

---

## Items dalam Wave 5

| ID  | Temuan                        | Severity | Current State                                       |
| --- | ----------------------------- | -------- | --------------------------------------------------- |
| C5  | Plaintext password storage    | CRITICAL | Password compare `===` plaintext                    |
| H3  | In-memory token store         | HIGH     | `Map<string, session>`, hilang saat restart         |
| H4  | Tidak ada RBAC                | HIGH     | Semua authenticated users bisa akses semua endpoint |
| M7  | Token tanpa refresh mechanism | MEDIUM   | 24 jam window, tidak ada refresh                    |
| M8  | Token di localStorage         | MEDIUM   | Vulnerable XSS, JavaScript-accessible               |

### Kenapa Harus Dikerjakan Bersamaan

```
C5 (bcrypt) ← H3 (JWT) ← M7 (refresh token) ← M8 (httpOnly cookie)
                ↑
               H4 (RBAC — role embedded in JWT)
```

- JWT token berisi role claim → RBAC middleware bisa cek role dari token
- JWT menggantikan in-memory token store → H3 solved
- Refresh token perlu secure storage → httpOnly cookie solves M8
- Password hashing (bcrypt) independent tapi biasanya dikerjakan bersamaan

---

## Current State (Detail per Item)

### C5 — Plaintext Password

**File**: `packages/backend/src/application/services/AuthService.ts`

```typescript
// Line 22-24 — plaintext comparison
if (user.password !== dto.password) {
  throw new Error('Invalid credentials');
}

// Line 80 — plaintext storage in seed
password: 'admin123',
```

**User entity**: `packages/backend/src/domain/entities/User.ts`

```typescript
export interface User {
  id: string;
  username: string;
  password: string; // Currently plaintext
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Prisma schema** (`packages/backend/prisma/schema.prisma`):

```prisma
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  password  String
  fullName  String   @map("full_name")
  role      String   @default("ADMIN")
  isActive  Boolean  @default(true) @map("is_active")
  // ...
}
```

### H3 — In-Memory Token Store

**File**: `packages/backend/src/application/services/AuthService.ts`

```typescript
// Line 8-9 — Map-based token store
const tokenStore = new Map<string, { userId: string; expiresAt: Date }>();

// Line 28-38 — Token generation (random UUID)
const token = uuidv4();
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
tokenStore.set(token, { userId: user.id, expiresAt });

// Line 50-55 — Token validation
async validateToken(token: string): Promise<User | null> {
  const session = tokenStore.get(token);
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    tokenStore.delete(token);
    return null;
  }
  return this.userRepo.findById(session.userId);
}

// Line 63-65 — Logout (delete from Map)
async logout(token: string): Promise<void> {
  tokenStore.delete(token);
}
```

### H4 — No RBAC

**File**: `packages/backend/src/infrastructure/middleware/authMiddleware.ts`

```typescript
// Line 32-37 — Role captured but NOT used
req.user = {
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  role: user.role, // ← captured, never checked
};
```

**File**: `packages/backend/src/presentation/routes/index.ts`

- Semua endpoint hanya pakai `authMiddleware` — tidak ada role check
- Sensitive operations (delete, void, settings, scheduler) accessible oleh semua authenticated users

**Existing role in schema**:

```prisma
model User {
  role String @default("ADMIN")  // Field exists but unused for authorization
}
```

### M7 — No Refresh Token

- Token berlaku 24 jam (Line 30 AuthService.ts)
- Tidak ada refresh mechanism
- Jika token dicuri, berlaku penuh selama 24 jam
- User harus login ulang setiap 24 jam

### M8 — Token di localStorage

**File**: `packages/frontend/src/lib/api.ts`

```typescript
// Line 6-12 — Token stored in localStorage
setToken(token: string | null) {
  this.token = token;
  if (token) {
    if (typeof window !== 'undefined') localStorage.setItem('token', token);
  } else {
    if (typeof window !== 'undefined') localStorage.removeItem('token');
  }
}

// Line 15-21 — Token retrieval from localStorage
getToken(): string | null {
  if (this.token) return this.token;
  if (typeof window !== 'undefined') {
    this.token = localStorage.getItem('token');
  }
  return this.token;
}
```

**File**: `packages/frontend/src/store/auth.ts` — Zustand auth store

- Uses `api.setToken()` and `api.getToken()`

---

## Implementation Plan

### Urutan Implementasi (Ada Dependencies!)

```
Step 1: C5 — bcrypt password hashing (independent)
Step 2: H3 — JWT token (replaces UUID + Map)
Step 3: H4 — RBAC middleware (uses role from JWT)
Step 4: M7 + M8 — Refresh token + httpOnly cookie (requires JWT)
```

### Step 1: bcrypt Password Hashing (C5)

**Install**: `npm install bcryptjs && npm install -D @types/bcryptjs`

**Changes**:

1. `AuthService.ts` — `login()`:
   - Replace `user.password !== dto.password` with `await bcrypt.compare(dto.password, user.password)`
2. `AuthService.ts` — add `hashPassword()` utility method
3. Seed script (`prisma/seed.ts` atau `prisma/data/users.ts`):
   - Hash default password sebelum insert
   - Atau: tambah migration script one-time untuk hash existing passwords
4. Prisma migration: tidak perlu — `password` field sudah String

**Tests**: Update `auth.test.ts` — mock bcrypt atau gunakan bcrypt di test juga

### Step 2: JWT Token (H3)

**Install**: `npm install jsonwebtoken && npm install -D @types/jsonwebtoken`

**Changes**:

1. **Env vars**: Tambah `JWT_SECRET`, `JWT_EXPIRES_IN` (default "24h")
2. `config/index.ts` — Validate JWT_SECRET (required in production)
3. `AuthService.ts`:
   - Hapus `tokenStore` Map
   - `login()` → generate JWT: `jwt.sign({ userId, role }, JWT_SECRET, { expiresIn })`
   - `validateToken()` → `jwt.verify(token, JWT_SECRET)` lalu `findById(decoded.userId)`
   - `logout()` → untuk invalidation, bisa blacklist token in memory (short-lived) atau skip (JWT stateless)
4. `authMiddleware.ts` — Extract JWT, verify, attach user to req

**Tests**: Mock `jsonwebtoken` module di test files

### Step 3: RBAC Middleware (H4)

**Design**:

```typescript
// Roles
enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER',
}

// Middleware factory
function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role as UserRole)) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }
    next();
  };
}
```

**Changes**:

1. Domain: Buat `UserRole` enum di `domain/enums/`
2. Infrastructure: Buat `requireRole` middleware
3. Routes: Tambahkan role checks ke sensitive endpoints:
   - `DELETE *` → `SUPER_ADMIN` only
   - `PATCH /contracts/:id/cancel`, `PATCH /contracts/:id/repossess` → `SUPER_ADMIN, ADMIN`
   - `PUT /settings` → `SUPER_ADMIN`
   - `POST /scheduler/*` → `SUPER_ADMIN`
   - `GET *` (read-only) → semua role
4. Seed: Update user seed data dengan role assignments

### Step 4: Refresh Token + httpOnly Cookie (M7 + M8)

**Design**:

- Access token: JWT, short-lived (15 min), sent via `Authorization: Bearer`
- Refresh token: random UUID, long-lived (7 days), sent via httpOnly cookie
- Refresh token stored in DB (new `RefreshToken` model) atau in-memory Map

**Changes**:

1. Prisma schema: Tambah `RefreshToken` model (optional — bisa pakai Map untuk phase pertama)
2. `AuthService.ts`:
   - `login()` returns `{ accessToken, refreshToken }`
   - New `refresh()` method: validate refresh token → issue new access token
3. Backend routes: `POST /auth/refresh` endpoint
4. Frontend `api.ts`:
   - Hapus localStorage token
   - Access token hanya di memory (variable)
   - Refresh token via httpOnly cookie (set by backend, auto-sent by browser)
   - Interceptor: on 401 → call `/auth/refresh` → retry original request
5. CORS config: `credentials: true` (sudah ada)
6. Cookie config: `httpOnly: true, secure: true, sameSite: 'lax'`

---

## Critical Files to Modify

### Backend

- `src/application/services/AuthService.ts` — main auth logic
- `src/infrastructure/middleware/authMiddleware.ts` — JWT validation + RBAC
- `src/infrastructure/config/index.ts` — JWT_SECRET validation
- `src/presentation/routes/index.ts` — add requireRole to endpoints
- `src/domain/enums/index.ts` — UserRole enum
- `src/index.ts` — pass new config to services
- `prisma/schema.prisma` — RefreshToken model (Step 4)
- `prisma/data/users.ts` — hashed passwords + roles

### Frontend

- `src/lib/api.ts` — remove localStorage, add refresh interceptor
- `src/store/auth.ts` — update auth flow
- `src/hooks/useApi.ts` — handle 401 + refresh

### Tests

- `src/__tests__/auth.test.ts` — major update (bcrypt, JWT mocking)
- Other test files: may need minor updates if constructor signatures change

---

## Verification Checklist

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm test` — all tests pass
- [ ] Password di database sudah hashed (bcrypt)
- [ ] Login flow berfungsi (bcrypt compare)
- [ ] JWT token diterima dan divalidasi
- [ ] Role-based access enforced (VIEWER tidak bisa delete)
- [ ] Refresh token flow works (access token expired → auto refresh)
- [ ] Token TIDAK ada di localStorage (check browser DevTools)
- [ ] httpOnly cookie ter-set saat login
- [ ] Logout menghapus refresh token
- [ ] Frontend masih berfungsi normal (semua page accessible sesuai role)

---

## Risiko & Catatan

1. **Breaking change di frontend**: Auth flow berubah total (localStorage → cookie). Frontend dan backend harus di-deploy bersamaan.
2. **Existing sessions invalid**: Setelah deploy, semua user harus login ulang (token format berubah).
3. **Seed data**: Password hashing di seed script — `bcrypt.hashSync('admin123', 10)` di build time.
4. **Test impact**: `auth.test.ts` perlu rewrite signifikan. Service tests lain minimal impact (auth bukan dependency).
5. **JWT_SECRET management**: Harus di-set di Railway env vars. Jangan hardcode.
