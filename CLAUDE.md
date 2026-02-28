# WEDISON RTO Management System - Technical Documentation

> Single source of truth for project progress and architecture decisions.

## Project Overview

- **Company**: WEDISON (Motor Listrik / Electric Motorcycle)
- **System**: Internal RTO (Rent To Own) Management
- **Users**: Admin only (no customer login)
- **Motor Models**: Athena (55K/day), Victory (55K/day), EdPower (75K/day)
- **Max Rental**: 7 days per transaction

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, ShadCN UI |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Backend | Express.js, TypeScript, Clean Architecture |
| Data | In-Memory (Repository Pattern, ready for PostgreSQL/Prisma) |
| Monorepo | npm workspaces |

## Architecture

```
Clean Architecture:
Domain → Application → Infrastructure → Presentation

Backend:
  domain/        - Entities, Enums, Repository Interfaces
  application/   - Services (business logic), DTOs (Zod validation)
  infrastructure/- In-Memory Repositories, Middleware, Config
  presentation/  - Controllers, Routes

Frontend:
  app/(dashboard)/ - Protected pages with sidebar layout
  app/login/       - Public login page
  components/ui/   - ShadCN-style UI components
  lib/             - API client, utilities
  stores/          - Zustand state management
  types/           - Shared TypeScript types
```

## Default Credentials

- Username: `admin`
- Password: `admin123`

## Running the Project

```bash
# Install dependencies
npm install

# Start both frontend and backend
npm run dev

# Start backend only (port 3001)
npm run dev:backend

# Start frontend only (port 3000)
npm run dev:frontend
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Admin login |
| POST | /api/auth/logout | Admin logout |
| GET | /api/auth/me | Get current user |
| GET | /api/dashboard/stats | Dashboard statistics |
| GET/POST | /api/customers | List/Create customers |
| GET/PUT/DELETE | /api/customers/:id | Get/Update/Delete customer |
| GET/POST | /api/contracts | List/Create contracts |
| PATCH | /api/contracts/:id/status | Update contract status |
| GET | /api/invoices | List invoices |
| GET | /api/invoices/:id/qr | Generate QR code |
| POST | /api/invoices/:id/payment | Simulate payment |
| GET | /api/reports | Get report data |
| GET | /api/reports/export/json | Export report as JSON |
| GET | /api/reports/export/csv | Export report as CSV |
| GET | /api/audit-logs | Get audit logs |
| GET/PUT | /api/settings | Get/Update settings |

---

## 2026-02-28 - Phase 1: Full Stack Foundation

### What was built

**Monorepo Structure:**
- Root `package.json` with npm workspaces (`packages/backend`, `packages/frontend`)
- Shared TypeScript base config (`tsconfig.base.json`)
- Concurrent dev script for running both apps

**Backend (Express + TypeScript + Clean Architecture):**

1. **Domain Layer:**
   - 6 Entity interfaces: User, Customer, Contract, Invoice, AuditLog, Setting
   - Enums: MotorModel, ContractStatus, PaymentStatus, AuditAction, UserRole
   - Constants: MOTOR_DAILY_RATES, MAX_RENTAL_DAYS
   - 6 Repository interfaces (contracts for data access)

2. **Application Layer:**
   - DTOs with Zod validation: LoginDto, CreateCustomerDto, CreateContractDto, etc.
   - 8 Service classes:
     - AuthService: login, logout, token management, seed admin
     - CustomerService: CRUD with KTP dedup check
     - ContractService: create with auto-calculation, auto-invoice generation
     - InvoiceService: QR generation (qrcode lib), payment simulation
     - DashboardService: aggregate stats from all repos
     - ReportService: generate reports, export JSON/CSV
     - AuditService: query audit logs
     - SettingService: CRUD settings with defaults

3. **Infrastructure Layer:**
   - 6 In-Memory Repository implementations (Map-based)
   - Auth middleware (token-based)
   - Error handler middleware
   - Environment config

4. **Presentation Layer:**
   - 8 Controller classes
   - RESTful route setup with auth middleware

**Frontend (Next.js 16 + Tailwind v4 + ShadCN):**

1. **UI Components (ShadCN-style):**
   - Button (7 variants), Card, Input, Label, Badge (6 variants), Select, Dialog, Textarea

2. **Core Infrastructure:**
   - API client class with token management and error handling
   - Zustand auth store
   - AuthGuard component
   - Utility functions (formatCurrency, formatDate, formatDateTime)
   - Shared TypeScript types

3. **Pages (8 total):**
   - Login page (public)
   - Dashboard (stats cards + recent activity)
   - Customers (CRUD table + search + dialog forms)
   - Contracts (create with auto-calculation + status badges)
   - Invoices (list + QR code dialog)
   - Payments (simulation: mark PAID/FAILED)
   - Reports (summary cards + JSON/CSV export)
   - Audit Log (table with action badges)
   - Settings (editable key-value config)

4. **Layout:**
   - Sidebar navigation with active state
   - User info + logout in sidebar footer
   - Responsive card-based layouts

### Why

- Clean Architecture ensures business logic is independent of framework/database
- Repository Pattern allows swapping in-memory → PostgreSQL without changing services
- Monorepo keeps frontend/backend in sync
- ShadCN approach gives full control over UI components
- Zustand chosen for simplicity over Redux

### Affected Modules

All modules created from scratch:
- `packages/backend/` - Full backend
- `packages/frontend/` - Full frontend
- `package.json` - Root monorepo config
- `tsconfig.base.json` - Shared TS config

---

## 2026-02-28 - Phase 2: Enhancements & Testing

### What was built

**Backend Enhancements:**

1. **Seed Dummy Data** (`infrastructure/seed.ts`):
   - 8 realistic Indonesian customers with valid KTP numbers
   - 9 contract scenarios: 3 active, 4 completed, 1 overdue, 1 failed payment
   - Auto-generated invoices and audit logs per contract
   - Runs on startup only if no customers exist

2. **Contract Detail Endpoint** (`GET /api/contracts/:id/detail`):
   - Returns contract + customer + invoice in single response
   - New `getDetailById` method on ContractService

3. **Invoice Filtering** (`GET /api/invoices?customerId=`):
   - Invoice list endpoint now accepts `customerId` query param

4. **Contract by Customer** (`GET /api/contracts/customer/:customerId`):
   - Route to fetch all contracts for a specific customer

5. **Unit Tests (Jest)** - 52 tests across 4 test suites:
   - `AuthService.test.ts` - login, logout, token validation, seed admin
   - `CustomerService.test.ts` - CRUD, KTP dedup, search
   - `ContractService.test.ts` - create with auto-calc, max days validation, detail
   - `InvoiceService.test.ts` - payment simulation, QR generation, revenue totals

**Frontend Enhancements:**

1. **Customer Detail Page** (`/customers/[id]`):
   - Customer info card with stats (total contracts, total paid, pending amount)
   - Contract history table (clickable rows → contract detail)
   - Invoice history table

2. **Contract Detail Page** (`/contracts/[id]`):
   - Contract info, customer card, invoice section
   - QR code generation button + payment simulation (PAID/FAILED)

3. **Toast Notification System**:
   - Zustand toast store (`stores/toastStore.ts`)
   - Animated toast component (`components/Toaster.tsx`) with success/error/default variants
   - Integrated in: Customers (CRUD), Contracts (create), Payments (simulation)

4. **Search/Filter on Contracts**:
   - Search by contract number, customer name, motor model
   - Filter by status (ALL/ACTIVE/COMPLETED/OVERDUE/CANCELLED)
   - Client-side filtering

5. **Search/Filter on Invoices**:
   - Search by invoice number
   - Filter by payment status (ALL/PENDING/PAID/FAILED)

6. **Mobile Responsive Sidebar**:
   - Hidden on mobile (< lg breakpoint)
   - Mobile header bar with hamburger menu button
   - Slide-in sidebar overlay on mobile with close button
   - Body scroll lock when mobile sidebar open
   - Auto-close on route change

7. **Navigation Improvements**:
   - Eye icon view button on customer list → customer detail
   - Clickable contract rows → contract detail

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/contracts/:id/detail | Contract + customer + invoice detail |
| GET | /api/contracts/customer/:customerId | Contracts by customer |
| GET | /api/invoices?customerId=X | Filter invoices by customer |

### New Files

- `packages/backend/src/infrastructure/seed.ts`
- `packages/backend/src/__tests__/AuthService.test.ts`
- `packages/backend/src/__tests__/CustomerService.test.ts`
- `packages/backend/src/__tests__/ContractService.test.ts`
- `packages/backend/src/__tests__/InvoiceService.test.ts`
- `packages/frontend/src/app/(dashboard)/customers/[id]/page.tsx`
- `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx`
- `packages/frontend/src/stores/toastStore.ts`
- `packages/frontend/src/components/Toaster.tsx`

### Phase 2 Status

- [x] Seed realistic dummy data for testing
- [x] Customer detail page with contract history
- [x] Contract detail page with invoice & payment status
- [x] Search/filter on contracts and invoices
- [x] Unit tests (Jest) for services (52 tests, 4 suites)
- [x] Toast notifications for success/error
- [x] Mobile responsive sidebar (hamburger menu)

---

## Development Roadmap

> Prinsip: Fungsionalitas dulu → Polish & UX → Infrastruktur & Produksi.
> Setiap phase harus menghasilkan sistem yang lebih lengkap dan siap pakai.

### Phase 3: Core RTO Mechanics (Fundamental Business Logic)

Fokus: Memperbaiki model bisnis agar benar-benar mencerminkan sistem **Rent To Own** — bukan sewa harian lepas.

- [ ] **Remodel kontrak sebagai RTO**
  - Kontrak = komitmen jangka panjang (default 5 tahun / 1825 hari, configurable via Settings)
  - Tambah field: `ownershipTargetDays`, `totalDaysPaid`, `ownershipProgress` (%)
  - Status baru: `REPOSSESSED` (motor ditarik karena tidak lanjut bayar)
  - Status `COMPLETED` = customer sudah lunas & motor menjadi milik customer
- [ ] **Perpanjangan sewa (Top-Up / Extend)**
  - Endpoint `POST /api/contracts/:id/extend` (maks 7 hari per top-up)
  - Generate invoice baru untuk periode perpanjangan
  - Update `totalDaysPaid` dan `ownershipProgress` di kontrak
  - Tidak membuat kontrak baru — tetap pakai kontrak yang sama
  - Frontend: tombol "Perpanjang Sewa" di halaman contract detail
- [ ] **Penarikan motor (Repossession)**
  - Jika customer tidak memperpanjang dalam grace period (configurable, default 7 hari)
  - Endpoint `PATCH /api/contracts/:id/repossess`
  - Ubah status → `REPOSSESSED`, catat tanggal penarikan
  - Audit log untuk setiap penarikan
- [ ] **Grace period & overdue logic**
  - Hitung otomatis apakah kontrak sudah melewati grace period
  - Status otomatis berubah: `ACTIVE` → `OVERDUE` → `REPOSSESSED`
  - Dashboard warning untuk kontrak yang mendekati/melewati grace period
- [ ] **Ownership completion**
  - Ketika `totalDaysPaid >= ownershipTargetDays`, status → `COMPLETED`
  - Catat tanggal kepemilikan resmi
  - Tampilkan progress bar kepemilikan di contract detail

### Phase 4: Admin Controls & Contract Management

Fokus: Kontrol penuh untuk admin atas semua data dan operasi.

- [ ] **Edit kontrak**
  - Endpoint `PUT /api/contracts/:id`
  - Admin bisa edit: motor model, catatan, grace period, ownership target
  - Tidak bisa edit field kalkulasi otomatis (totalDaysPaid, progress)
  - Frontend: form edit di contract detail page
- [ ] **Cancel / terminate kontrak**
  - Endpoint `PATCH /api/contracts/:id/cancel`
  - Alasan pembatalan wajib diisi (reason field)
  - Catat di audit log
- [ ] **Delete kontrak** (soft delete)
  - Tandai `isDeleted: true` daripada hapus permanen
  - Kontrak yang di-delete tidak muncul di list tapi masih ada di database
- [ ] **Edit & delete customer** improvements
  - Validasi: tidak bisa hapus customer yang masih punya kontrak aktif
  - Cascade warning jika customer punya kontrak/invoice terkait
- [ ] **Edit invoice**
  - Admin bisa menandai invoice sebagai VOID/CANCELLED
  - Koreksi pembayaran manual (mark as paid tanpa simulasi)
- [ ] **Bulk operations**
  - Tandai beberapa invoice sebagai PAID sekaligus
  - Export data customer/kontrak yang diseleksi
- [ ] **Konfirmasi dialog** untuk semua operasi destructive (delete, cancel, repossess)

### Phase 5: Financial Features & Reporting

Fokus: Tracking keuangan yang akurat dan laporan yang berguna.

- [ ] **Payment history timeline**
  - Riwayat semua pembayaran per kontrak dalam format timeline
  - Tampilkan tanggal bayar, jumlah, metode, status
- [ ] **Denda keterlambatan (late fee)**
  - Configurable via Settings (persentase atau nominal tetap per hari)
  - Auto-calculate saat kontrak overdue
  - Tampil di invoice sebagai item terpisah
- [ ] **Revenue dashboard**
  - Total pendapatan per bulan/minggu/hari
  - Pendapatan per model motor
  - Outstanding (belum dibayar) vs collected (sudah dibayar)
- [ ] **Enhanced reports**
  - Laporan kontrak aktif vs overdue vs completed vs repossessed
  - Laporan aging (kontrak berdasarkan umur)
  - Laporan customer: top spender, paling sering overdue
  - Filter laporan berdasarkan rentang tanggal
- [ ] **PDF invoice generation**
  - Generate PDF invoice untuk dicetak/dikirim ke customer
  - Include QR code di dalam PDF
- [ ] **Export improvements**
  - Export laporan ke Excel (XLSX) selain CSV/JSON

### Phase 6: UX Polish & Frontend Improvements

Fokus: Pengalaman pengguna yang lebih baik dan UI yang lebih lengkap.

- [ ] **Enhanced dashboard with charts**
  - Grafik pendapatan (line/bar chart)
  - Pie chart distribusi status kontrak
  - Grafik tren customer baru per bulan
  - Library: Chart.js atau Recharts
- [ ] **Pagination on all list views**
  - Server-side pagination untuk customers, contracts, invoices, audit logs
  - Endpoint support `?page=1&limit=20`
  - Frontend pagination component
- [ ] **Form validation with React Hook Form + Zod**
  - Validasi frontend yang konsisten dengan backend DTOs
  - Inline error messages
  - Validasi real-time (on blur / on change)
- [ ] **Table sorting**
  - Klik header kolom untuk sort ascending/descending
  - Sort by tanggal, nama, status, jumlah
- [ ] **Date range picker**
  - Filter data berdasarkan rentang tanggal di semua halaman list
- [ ] **Loading states & skeleton UI**
  - Skeleton loader saat fetch data
  - Disabled state pada tombol saat proses berlangsung
- [ ] **Empty states**
  - Ilustrasi/pesan yang informatif ketika belum ada data
- [ ] **Keyboard shortcuts**
  - `Ctrl+K` untuk quick search global
  - `Escape` untuk tutup dialog

### Phase 7: Security & Authentication

Fokus: Keamanan yang proper sebelum masuk produksi.

- [ ] **JWT authentication with bcrypt**
  - Replace token sederhana dengan JWT (access + refresh token)
  - Password hashing dengan bcrypt
  - Token expiration & auto-refresh
- [ ] **Role-based access control (RBAC)**
  - Roles: `SUPER_ADMIN`, `ADMIN`, `VIEWER`
  - `SUPER_ADMIN`: full access + manage users
  - `ADMIN`: CRUD operations, tidak bisa manage users
  - `VIEWER`: read-only access
  - Middleware authorization per endpoint
  - Frontend: sembunyikan/disable UI berdasarkan role
- [ ] **User management (CRUD admin users)**
  - Halaman manage users (hanya SUPER_ADMIN)
  - Create, edit, deactivate admin users
  - Reset password
- [ ] **Session management**
  - Logout dari semua device
  - Lihat active sessions
- [ ] **Audit log improvements**
  - Catat user yang melakukan aksi
  - IP address logging
  - Filter audit log berdasarkan user dan action type

### Phase 8: Database Migration & Production Readiness

Fokus: Migrasi ke database nyata dan persiapan production.

- [ ] **PostgreSQL + Prisma migration**
  - Setup Prisma schema berdasarkan domain entities
  - Buat Prisma-based repository implementations
  - Migration scripts
  - Swap in-memory → Prisma repositories
  - Seed data via Prisma seeder
- [ ] **File upload (KTP images)**
  - Upload foto KTP saat registrasi customer
  - Storage: local filesystem (dev) / S3-compatible (prod)
  - Image preview di customer detail
- [ ] **Environment configuration**
  - `.env` management untuk dev/staging/production
  - Docker Compose untuk local development
- [ ] **Error monitoring & logging**
  - Structured logging (winston/pino)
  - Error tracking setup
- [ ] **Database backup strategy**
  - Automated backup scripts
  - Point-in-time recovery plan

### Phase 9: Integration & Deployment

Fokus: Integrasi dengan layanan eksternal dan deployment.

- [ ] **Real QRIS payment gateway integration**
  - Integrasi dengan payment gateway (Midtrans/Xendit)
  - Webhook handler untuk konfirmasi pembayaran otomatis
  - Replace payment simulation dengan flow asli
- [ ] **Notifikasi**
  - WhatsApp/SMS reminder untuk pembayaran yang akan jatuh tempo
  - Email receipt setelah pembayaran berhasil
  - Notifikasi internal (in-app) untuk admin
- [ ] **Deployment**
  - CI/CD pipeline (GitHub Actions)
  - Production deployment (VPS/Cloud)
  - SSL/HTTPS setup
  - Domain configuration
