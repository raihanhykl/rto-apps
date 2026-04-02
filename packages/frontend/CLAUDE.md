# CLAUDE.md — Frontend Package

> Instruksi spesifik untuk `packages/frontend/`.
> Dibaca bersama root `CLAUDE.md` yang berisi instruksi global.
>
> **Sub-CLAUDE.md di frontend:**
>
> - `e2e/CLAUDE.md` — E2E testing rules (Playwright)

---

## Tech Stack Frontend

- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS v4
- **Components**: ShadCN-style manual components di `src/components/ui/`
- **Data Fetching**: SWR
- **Forms**: React Hook Form + Zod resolver
- **State (auth)**: Zustand
- **Charts**: Recharts
- **E2E Testing**: Playwright

---

## Tailwind CSS v4 — WAJIB PERHATIKAN

**Ini Tailwind v4, BUKAN v3. Syntax berbeda!**

```css
/* BENAR — v4 */
@import 'tailwindcss';
@theme inline {
  --color-primary: #...;
}
@custom-variant dark (&:where(.dark, .dark *));
```

```css
/* SALAH — v3 (JANGAN GUNAKAN) */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- TIDAK ada `tailwind.config.js` untuk konfigurasi — semua via CSS `@theme`.
- Class utilities sama seperti v3, hanya setup yang berbeda.

---

## UI Components (ShadCN-style)

- Semua components ada di `src/components/ui/` — **ditulis manual, bukan install dari registry ShadCN**.
- Ini berarti kita punya full control — bisa modifikasi langsung tanpa `shadcn` CLI.
- Jangan install komponen dari ShadCN registry — edit file `src/components/ui/` langsung.
- Ikuti pattern components yang sudah ada saat membuat komponen baru.

### Struktur Component

```
src/components/
├── ui/            # Base UI components (Button, Input, Select, Dialog, dll.)
├── charts/        # Recharts wrappers
└── skeletons/     # Loading skeleton components
```

---

## Data Fetching — SWR (WAJIB)

**Semua API calls untuk READ data WAJIB melalui SWR hooks.**

```typescript
// BENAR — gunakan SWR
import { useApi } from '@/hooks/useApi';

const { data, error, isLoading } = useApi<Contract[]>('/contracts');
```

```typescript
// SALAH — JANGAN gunakan pattern ini
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/contracts')
    .then((r) => r.json())
    .then(setData);
}, []);
```

### TTL Tiers (dikonfigurasi di `hooks/useApi.ts`)

| Tier    | Duration | Digunakan untuk                             |
| ------- | -------- | ------------------------------------------- |
| LONG    | 10 menit | Data yang jarang berubah (settings, config) |
| MEDIUM  | 5 menit  | Data yang berubah sedang (customers)        |
| DEFAULT | 1 menit  | Data umum (contracts, invoices)             |
| SHORT   | 15 detik | Data real-time (dashboard stats, payment)   |

### Invalidasi Setelah Mutasi

Setelah create/edit/delete, gunakan `useInvalidate()` untuk refresh data:

```typescript
const invalidate = useInvalidate();

// Setelah create customer:
await api.post('/customers', data);
invalidate('/customers', '/dashboard');

// Setelah bayar invoice:
await api.post(`/invoices/${id}/pay`, {});
invalidate('/invoices', '/contracts', '/dashboard');
```

---

## Form Validation — React Hook Form + Zod

```typescript
// Pattern standar
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCustomerSchema } from '@/lib/schemas';

const form = useForm({
  resolver: zodResolver(createCustomerSchema),
  defaultValues: { name: '', ... },
});
```

- **Semua schema di `src/lib/schemas.ts`** — jangan buat schema baru di file page/component.
- Untuk `<Select>` (Radix/ShadCN) → gunakan `Controller` pattern, bukan `register`:

```typescript
// BENAR untuk Select:
<Controller
  name="motorModel"
  control={form.control}
  render={({ field }) => (
    <Select value={field.value} onValueChange={field.onChange}>
      ...
    </Select>
  )}
/>

// SALAH untuk Select:
<Select {...form.register('motorModel')}>  {/* tidak work */}
```

---

## State Management

- **Zustand**: HANYA untuk auth store di `src/stores/authStore.ts`.
- **SWR**: Untuk semua server state (data dari API).
- **JANGAN** duplicate server state ke Zustand — menyebabkan stale data.
- Local UI state (modal open/close, form step) → `useState` di component yang relevan.

---

## UI Text — Bahasa Indonesia

**SEMUA text yang dilihat user harus Bahasa Indonesia.**

| Bahasa Indonesia    | Bukan                |
| ------------------- | -------------------- |
| "Tambah Customer"   | "Add Customer"       |
| "Cari..."           | "Search..."          |
| "Simpan"            | "Save"               |
| "Batal"             | "Cancel"             |
| "Hapus"             | "Delete"             |
| "Tagihan"           | "Invoice/Bill"       |
| "Kontrak"           | "Contract"           |
| "Berhasil disimpan" | "Successfully saved" |
| "Terjadi kesalahan" | "An error occurred"  |

**Pengecualian (boleh bahasa Inggris):**

- Nama proper: "Customer", "Contract", "Dashboard", "QR Code", "BAST"
- Istilah teknis umum yang sudah dimengerti admin: "Status", "ID", "PDF", "Export"

---

## App Router Structure

```
src/app/
├── (dashboard)/           # Layout dengan sidebar + navbar
│   ├── layout.tsx         # Dashboard layout (auth-gated)
│   ├── audit/             # Halaman audit log
│   ├── contracts/         # List kontrak + [id] detail
│   ├── customers/         # List customer + [id] detail
│   ├── invoices/          # List tagihan
│   ├── reports/           # Laporan keuangan
│   └── settings/          # System settings
└── login/                 # Auth page (tidak dalam dashboard layout)
```

---

## API Client

- **File**: `src/lib/api.ts`
- Base URL: `process.env.NEXT_PUBLIC_API_URL` (default: `http://localhost:3001/api`)
- Semua API calls melalui helper functions di file ini — jangan `fetch` langsung di component.
- Error handling terpusat di api client.

---

## Frontend Dev Commands

```bash
# Development
npm run dev:frontend                      # Start frontend (port 3000)

# Build & Type Check
cd packages/frontend && npm run build     # Next.js production build
cd packages/frontend && npx tsc --noEmit  # TypeScript check

# Linting
npm run lint:frontend                     # ESLint dengan Next.js rules

# E2E Testing (lihat e2e/CLAUDE.md untuk detail)
cd packages/frontend && npm run e2e       # Run E2E tests
cd packages/frontend && npm run e2e:ui    # Playwright UI mode
cd packages/frontend && npm run e2e:headed # Headed browser mode
```

---

## Performance Guidelines

- Gunakan `dynamic()` import untuk komponen berat (charts, PDF viewer).
- Server components untuk halaman yang tidak butuh interaktivitas.
- Client components (`'use client'`) hanya saat perlu: hooks, event handlers, browser APIs.
- Skeleton loading sudah ada di `src/components/skeletons/` — gunakan saat data loading.
- Pagination sudah diimplementasikan — jangan load semua data sekaligus.
