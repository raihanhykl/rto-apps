# CLAUDE.md — E2E Tests (Playwright)

> Instruksi untuk `packages/frontend/e2e/`.
> E2E tests menggunakan Playwright yang auto-start backend + frontend.

---

## Tech Stack E2E

- **Framework**: Playwright
- **Config**: `packages/frontend/playwright.config.ts`
- **Browser**: Chromium (default), bisa multi-browser
- **Auto-start**: webServer config di `playwright.config.ts` otomatis start backend + frontend

---

## Commands

```bash
# Run semua E2E tests (headless)
cd packages/frontend && npm run e2e

# Playwright UI mode (visual test explorer)
cd packages/frontend && npm run e2e:ui

# Headed mode (lihat browser saat test berjalan)
cd packages/frontend && npm run e2e:headed

# Run test file spesifik
cd packages/frontend && npx playwright test e2e/auth.spec.ts

# Run dengan trace (untuk debugging)
cd packages/frontend && npx playwright test --trace on
```

---

## Test Suites yang Ada

| File                | Coverage                           |
| ------------------- | ---------------------------------- |
| `auth.spec.ts`      | Login, logout, auth redirect       |
| `dashboard.spec.ts` | Dashboard stats, navigation        |
| `customers.spec.ts` | CRUD customers, search, pagination |

---

## webServer Config

Playwright otomatis start backend dan frontend via `playwright.config.ts`:

- Backend: `npm run dev:backend` di port 3001
- Frontend: `npm run dev:frontend` di port 3000
- Wait sampai kedua server ready sebelum test dimulai

---

## Playwright MCP

Playwright MCP tersedia untuk **interaksi browser langsung dari Claude Code**:

```typescript
// Bisa gunakan tools:
mcp__playwright__browser_navigate;
mcp__playwright__browser_click;
mcp__playwright__browser_fill_form;
mcp__playwright__browser_snapshot;
mcp__playwright__browser_take_screenshot;
// dll.
```

Gunakan Playwright MCP untuk:

- Debugging UI secara visual
- Explorasi halaman yang belum ada test-nya
- Verifikasi behavior secara langsung sebelum tulis test

---

## Pattern Test E2E

```typescript
import { test, expect } from '@playwright/test';

test.describe('Customer Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login sebelum setiap test
    await page.goto('/login');
    await page.fill('[name="username"]', 'admin');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('should create new customer', async ({ page }) => {
    await page.goto('/customers');
    await page.click('text=Tambah Customer');
    // fill form...
    await page.click('text=Simpan');
    await expect(page.locator('text=Berhasil')).toBeVisible();
  });
});
```

---

## Aturan E2E Testing

1. **E2E test hanya dijalankan di CI saat PR ke main** (bukan PR ke staging).
2. Gunakan **data test yang terisolasi** — jangan bergantung pada seed data production.
3. Pastikan test cleanup setelah selesai (atau gunakan test-specific data).
4. Assertion harus verify **user-visible behavior**, bukan implementation detail.
5. Gunakan locator berbasis text/role/label (accessible queries) — hindari CSS selector yang rapuh.
6. Saat test gagal di CI, gunakan `--trace on` untuk debug → lihat trace di Playwright report.

---

## Menambah E2E Test Baru

1. Buat file `e2e/namafitur.spec.ts`
2. Ikuti pattern `test.describe` + `test.beforeEach` untuk login
3. Test happy path + error path yang visible ke user
4. Jalankan `npm run e2e:headed` untuk verifikasi visual
5. Pastikan test pass di `npm run e2e` (headless) sebelum commit
