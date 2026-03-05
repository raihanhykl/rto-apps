# Development Changelog

> Complete history of all development phases, features, bug fixes, and architectural changes.
> For project overview and setup instructions, see `../README.md`.
> For AI instructions, see `../CLAUDE.md`.

---

## Table of Contents

- [Phase 1: Full Stack Foundation (2026-02-28)](#2026-02-28---phase-1-full-stack-foundation)
- [Phase 2: Enhancements & Testing (2026-02-28)](#2026-02-28---phase-2-enhancements--testing)
- [Phase 3: Core RTO Mechanics (2026-02-28)](#2026-02-28---phase-3-core-rto-mechanics)
- [Phase 4: Admin Controls (2026-02-28)](#2026-02-28---phase-4-admin-controls--contract-management)
- [Phase 5: Financial Features (2026-03-01)](#2026-03-01---phase-5-financial-features--reporting)
- [Phase 5.5: Business Logic Audit (2026-03-01)](#2026-03-01---phase-55-business-logic-audit--refinement)
- [Phase 6: UX Polish (2026-03-02)](#2026-03-02---phase-6-ux-polish--frontend-improvements)
- [Phase 6.5: RTO Business Model Overhaul (2026-03-03)](#2026-03-03---phase-65-rto-business-model-overhaul)
- [Data Model Update (2026-03-03)](#2026-03-03---data-model-update-customer--contract-fields)
- [Bug Fixes & UX (2026-03-03)](#2026-03-03---bug-fixes-ux-improvements--admin-controls)
- [Billing & Calendar Fixes (2026-03-03)](#2026-03-03---billing-accumulation-calendar--state-refresh-fixes)
- [Calendar Color Fix (2026-03-03)](#2026-03-03---payment-calendar-color-logic-fix)
- [Calendar Coverage Fix (2026-03-03)](#2026-03-03---calendar-coverage--sunday-aware-enddate-fix)
- [Libur Bayar & Manual Billing (2026-03-03)](#2026-03-03---libur-bayar-logic-fix--manual-billing-as-active-billing)
- [Phase 8: PostgreSQL + Prisma (2026-03-03)](#2026-03-03---phase-8-postgresql--prisma-migration)
- [Scheduler Upgrade (2026-03-04)](#2026-03-04---scheduler-upgrade-node-cron)
- [Git & CI Setup (2026-03-04)](#2026-03-04---sdlc-git-branching-strategy--ci-setup)
- [SWR Caching (2026-03-04)](#2026-03-04---frontend-api-caching-with-swr)
- [Seed Best Practices & Lainnya (2026-03-05)](#2026-03-05---seed-script-best-practices--lainnya-ride-hailing-apps)
- [Development Roadmap](#development-roadmap)

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

### Tests: 52 tests, 4 suites

---

## 2026-02-28 - Phase 3: Core RTO Mechanics

### What was built

**Business Model Remodel:**
The system was transformed from a simple daily rental model to a true Rent-To-Own (RTO) system where customers progressively earn ownership of the motor through repeated rental extensions.

**Backend Changes:**

1. **Contract Entity Remodel** - Added RTO fields:
   - `ownershipTargetDays` (default 1825 = 5 years)
   - `totalDaysPaid` (cumulative days across all extensions)
   - `ownershipProgress` (0-100%)
   - `gracePeriodDays` (default 7 days before repossession)
   - `repossessedAt`, `completedAt`

2. **New ContractStatus: `REPOSSESSED`** - Motor taken back due to non-payment

3. **Contract Extension** (`POST /api/contracts/:id/extend`):
   - Max 7 days per extension (same contract, new invoice)
   - Updates `totalDaysPaid`, `ownershipProgress`, extends `endDate`
   - Auto-completes contract when `totalDaysPaid >= ownershipTargetDays`
   - Works on ACTIVE and OVERDUE contracts

4. **Repossession** (`PATCH /api/contracts/:id/repossess`):
   - Marks contract as REPOSSESSED with timestamp
   - Validation: cannot repossess completed/cancelled/already repossessed
   - Full audit logging

5. **Overdue Warnings** (`GET /api/contracts/overdue-warnings`):
   - Returns contracts nearing or past their end date
   - Includes days overdue and grace period remaining

6. **Invoice Model Change**:
   - `findByContractId` now returns `Invoice[]` (multiple invoices per contract)
   - Payment no longer auto-completes contract (ownership-based completion instead)

7. **Updated Settings Defaults**:
   - `ownership_target_days` = 1825 (configurable)
   - `grace_period_days` = 7 (configurable)

8. **Dashboard** - Added `repossessedContracts` stat

9. **Updated Seed Data** - 9 contract scenarios with RTO model

**Frontend Changes:**

1. **Contract Detail Page (complete rewrite)**:
   - Ownership progress bar with percentage and day counts
   - "Perpanjang Sewa" button with duration selector + cost preview
   - "Tarik Motor" button with confirmation dialog
   - Multiple invoices section (list with payment actions per invoice)
   - Status labels in Indonesian (Aktif, Lunas, Terlambat, Motor Ditarik)
   - Trophy banner for completed ownership
   - Alert banner for repossessed contracts

2. **Contract List Page**:
   - Added ownership progress bar column
   - Added REPOSSESSED to status filter
   - Renamed "Durasi" → "Progress"

3. **Dashboard** - Added "Repossessed" stat card

4. **Customer Detail** - Added REPOSSESSED status badge variant

5. **Frontend Types** - Updated Contract interface with RTO fields, DashboardStats with repossessedContracts

6. **API Client** - Added `extendContract()`, `repossessContract()`, `getOverdueWarnings()`

### Tests: 64 tests (up from 52)

### Phase 3 Bugfixes (2026-02-28)

**Extension payment-gated logic:**
- Invoice entity now has `extensionDays: number | null` field
- `ContractService.extend()` no longer updates contract fields immediately — it only creates an invoice with `extensionDays` set
- `InvoiceService.simulatePayment()` now applies extension to contract only when the extension invoice is successfully PAID
- Failed payment does NOT extend the contract
- `durationDays` now accumulates (initial + extensions) instead of being overwritten

**QR button receipt view:**
- Paid invoices: QR button shows "Bukti" (receipt) instead of "QR"
- Receipt dialog shows: payment success banner, invoice details, extension days info, small reference QR

**Contracts list - Sisa Hari column:**
- New "Sisa Hari" column shows remaining days before endDate
- Color-coded: red for overdue, yellow for ≤2 days

**Invoices list - No. Kontrak column:**
- New "No. Kontrak" column maps invoice to contract number

**Tests:** 67 tests passing (4 suites)

---

## 2026-02-28 - Phase 4: Admin Controls & Contract Management

### What was built

**Backend:**

1. **Edit Contract** (`PUT /api/contracts/:id`):
   - DTOs: `UpdateContractDto` (notes, gracePeriodDays, ownershipTargetDays - all optional)
   - Auto-recalculates ownershipProgress when ownershipTargetDays changes
   - Full audit logging

2. **Cancel Contract** (`PATCH /api/contracts/:id/cancel`):
   - DTOs: `CancelContractDto` (reason - required)
   - Appends `[CANCELLED]` reason to contract notes
   - Validation: rejects completed/cancelled/repossessed contracts

3. **Void Invoice** (`PATCH /api/invoices/:id/void`):
   - Sets invoice status to `VOID`
   - Rejects already paid or voided invoices
   - `PaymentStatus.VOID` added to enums

4. **Mark Paid** (`PATCH /api/invoices/:id/mark-paid`):
   - Manual payment marking (bypasses payment simulation)
   - Applies extension to contract if invoice has extensionDays
   - Audit log includes `manual: true` flag

5. **Customer Delete Validation**:
   - Cannot delete customer with active/overdue contracts

6. **Soft Delete Contract** (`DELETE /api/contracts/:id`):
   - `isDeleted` + `deletedAt` fields
   - Cannot delete active/overdue contracts

7. **Bulk Operations** (`POST /api/invoices/bulk-pay`):
   - Returns `{ success: string[], failed: Array<{ id, error }> }`

**Frontend:**
- Edit dialog (notes, grace period, ownership target + live progress preview)
- Cancel dialog (required reason, orange warning UI)
- Invoice actions (void, mark paid, confirmation dialogs)
- VOID status badge + filter option

### Tests: 86 tests (up from 67)

---

## 2026-03-01 - Phase 5: Financial Features & Reporting

### What was built

**Backend:**

1. **Late Fee Field** - `lateFee: number` on Invoice entity
   - `late_fee_per_day` setting (default Rp 10,000/day)

2. **Enhanced Reports** (`ReportService` rewrite):
   - Filters: startDate, endDate, status, motorModel
   - contractsByStatus, revenueByMotor, revenueByMonth, topCustomers
   - overdueCount, averageOwnershipProgress

3. **Export Improvements**:
   - XLSV export (tab-separated, Excel-compatible)
   - All exports support filters

4. **PDF Invoice Generation** (`PdfService`):
   - pdfkit library, full A4 invoice
   - `GET /api/invoices/:id/pdf`

**Frontend:**

1. **Enhanced Reports Page**:
   - Filter panel, summary cards, charts (CSS-based bars)
   - Revenue by motor/month, top customers table
   - Export: JSON, CSV, Excel (XLSV)

2. **Payment Timeline** on Contract Detail Page
3. **PDF Download** buttons on invoices

### New Files
- `packages/backend/src/application/services/PdfService.ts`

### Tests: 86 tests (unchanged)

---

## 2026-03-01 - Phase 5.5: Business Logic Audit & Refinement

### Context

Comprehensive audit of Phase 1-5 logic to fix MVP/dummy behaviors. ~20 issues identified and fixed across 7 batches.

### What was changed

**Backend - Core Logic Fixes:**

1. **Settings-driven configuration**: `ContractService` reads `max_rental_days`, `ownership_target_days`, `grace_period_days`, `late_fee_per_day` from settings at runtime.

2. **Payment-gated ownership**: Contract creation sets `totalDaysPaid: 0`, `ownershipProgress: 0`. Initial invoice has `extensionDays: dto.durationDays` so paying it credits days.

3. **Late fee calculation**: `lateFee = daysOverdue * lateFeePerDay` when contract is overdue.

4. **State machine enforcement**: `VALID_STATUS_TRANSITIONS` map, terminal states (COMPLETED, CANCELLED, REPOSSESSED). Auto-void PENDING/FAILED invoices on cancel/repossess. `extend()` blocked when PENDING invoices exist.

5. **Sequential numbering**: `RTO-YYMMDD-NNNN`, `INV-YYMMDD-NNNN`

6. **Shared payment logic**: `applyPaymentToContract()` used by both `simulatePayment()` and `markPaid()`.

7. **Customer soft delete**: `isDeleted`, `deletedAt` fields. Phone: `/^(\+62|62|0)8[0-9]{8,12}$/`. KTP: `/^\d{16}$/`.

8. **Repository filtering**: `findByCustomerId()`, `findByStatus()`, `countByStatus()`, `count()` filter `isDeleted`.

**Frontend Fixes:**
- Late fee display, timeline labels, motor rates from backend, error toasts, invoices page actions

### Tests: 88 tests (up from 86)

---

## 2026-03-02 - Phase 6: UX Polish & Frontend Improvements

### What was built

**Backend:**

1. **Pagination Infrastructure**:
   - `PaginationParams` interface: page, limit, sortBy, sortOrder, search, status, dates, module, customerId
   - `PaginatedResult<T>`: data, total, page, limit, totalPages
   - `findAllPaginated()` added to 4 repos, services, controllers
   - Backward compatible: `page` param triggers paginated, otherwise array

2. **Dashboard Chart Data**:
   - `chartData.revenueByMonth`: last 6 months
   - `chartData.contractsByStatus`: count per status

**Frontend:**

1. **Server-Side Pagination** (4 list pages):
   - `usePagination` hook, `<Pagination>` component, `<SortableHeader>` component
   - API methods: `getCustomersPaginated`, `getContractsPaginated`, `getInvoicesPaginated`, `getAuditLogsPaginated`

2. **Dashboard Charts** (Recharts):
   - `<RevenueChart>`: BarChart for revenue by month
   - `<StatusDistributionChart>`: PieChart (donut) for contracts by status
   - Dynamic imports with `ssr: false`

3. **Form Validation** (React Hook Form + Zod):
   - `schemas.ts`: loginSchema, customerSchema, contractSchema
   - Login, customer, contract forms converted

4. **Skeleton UI**: `<Skeleton>`, `<DashboardSkeleton>`, table skeleton rows

5. **Empty State**: `<EmptyState>` reusable component

6. **Command Palette** (`Ctrl+K`):
   - Global search: pages, customers, contracts
   - `useKeyboardShortcut` reusable hook

### New Files

| File | Description |
|------|-------------|
| `backend/src/domain/interfaces/Pagination.ts` | PaginationParams, PaginatedResult types |
| `frontend/src/components/ui/pagination.tsx` | Pagination navigation |
| `frontend/src/components/ui/skeleton.tsx` | Base skeleton |
| `frontend/src/components/SortableHeader.tsx` | Sortable table header |
| `frontend/src/components/EmptyState.tsx` | Reusable empty state |
| `frontend/src/components/CommandPalette.tsx` | Ctrl+K command palette |
| `frontend/src/components/charts/RevenueChart.tsx` | Revenue bar chart |
| `frontend/src/components/charts/StatusDistributionChart.tsx` | Status pie chart |
| `frontend/src/components/skeletons/DashboardSkeleton.tsx` | Dashboard skeleton |
| `frontend/src/components/skeletons/TableSkeleton.tsx` | Table skeleton |
| `frontend/src/hooks/usePagination.ts` | Pagination state hook |
| `frontend/src/hooks/useKeyboardShortcut.ts` | Keyboard shortcut hook |
| `frontend/src/lib/schemas.ts` | Zod validation schemas |

### Dependencies Added
- `recharts` (frontend)

### Tests: 88 tests (unchanged)

---

## 2026-03-03 - Phase 6.5: RTO Business Model Overhaul

### Context

Transformasi model bisnis RTO — DP, billing otomatis, DOKU, WhatsApp reminder. Implemented in micro-phases (MP-6A through MP-6I).

### Daftar Perubahan Bisnis

1. **Terminologi**: "Extend Sewa" / "Perpanjang Sewa" → "Bayar Tagihan"
2. **Down Payment (DP)**: Wajib bayar sebelum unit diterima. Skema: FULL atau INSTALLMENT (2x cicilan).
3. **Billing Lifecycle**: BILLING (belum bayar) → INVOICE (setelah bayar). Separate entities.
4. **Target Kepemilikan**: 1.825 → 1.278 hari
5. **Libur Bayar**: Minggu tertentu (2-4/bulan, configurable per contract)
6. **Rollover**: Billing tidak dibayar → expired → billing baru dengan akumulasi
7. **Payment Gateway**: DOKU (planned)
8. **WhatsApp Reminder**: Otomatis pagi & sore (planned)

### MP-6A: Domain Model & Enum Overhaul ✅

- Updated `Contract` entity: batteryType, unitReceivedDate, dpAmount, dpScheme, dpPaidAmount, holidayDaysPerMonth, billingStartDate
- Updated `Invoice` entity: type, dokuPaymentUrl, dokuReferenceId, billingPeriodStart, billingPeriodEnd
- Created `Billing` entity (daily billing lifecycle)
- Added enums: BatteryType, InvoiceType, BillingStatus, DPScheme
- Updated constants: OWNERSHIP_TARGET_DAYS=1278, DP_AMOUNTS, MOTOR_DAILY_RATES
- Created IBillingRepository + InMemoryBillingRepository
- Updated frontend types

### MP-6B: DP & Contract Creation Flow ✅

- Updated CreateContractDto: removed durationDays, added batteryType + dpScheme
- Rewrote ContractService.create() for DP flow (contract starts durationDays=0, totalAmount=0)
- Generate DP invoices: FULL=1 invoice (type=DP), INSTALLMENT=2 invoices (type=DP_INSTALLMENT, ceil/floor split)
- Added ContractService.receiveUnit(): validate DP paid, set unitReceivedDate + billingStartDate (H+1)
- Updated SettingService: ownership_target_days default 1278
- **Tests**: 93 tests (up from 88), 7 new receiveUnit tests

### MP-6C: Billing Lifecycle & Rollover ✅

- Created BillingService: generateDailyBilling(), rolloverExpiredBillings(), payBilling()
- Billing → Invoice conversion on payment
- Libur Bayar logic (Minggu auto-holiday + configurable holidays per month)
- Holiday billings: zero amount, auto-PAID, credits 1 free day
- Rollover: expired billing → new billing with accumulated amount
- Created scheduler.ts: node-cron daily (00:01 WIB)
- BillingController with routes
- **Tests**: 111 total (18 new BillingService tests)

### MP-6D: DOKU Payment Gateway (PENDING)

- [ ] DokuService, WebhookController, DOKU integration

### MP-6E: WhatsApp Reminder (PENDING)

- [ ] WhatsAppService, ReminderService, cron jobs

### MP-6F: Frontend — Terminologi & Contract Form ✅

- Renamed all "Perpanjang Sewa" → "Bayar Tagihan"
- Added battery type + DP scheme selectors in contract form
- DP cost preview with installment breakdown
- Updated contractSchema

### MP-6G: Frontend — Billing & DP UI ✅

- DP section in contract detail (status, scheme, amount, invoices)
- Billing section (active billing with pay, billing history)
- Libur Bayar info display
- Unit delivery + "Terima Unit" button with BAST dialog
- DP status column in contract list

### MP-6H: Frontend — Payment Gateway UI (PENDING)

### MP-6I: Seed Data & Tests Update (PENDING)

### Execution Order

```
MP-6A → MP-6B → MP-6F → MP-6C → MP-6G → MP-6D → MP-6H → MP-6E → MP-6I
```

### Dependency Graph

```
MP-6A (Domain Models)
  ├── MP-6B (DP & Contract) ──┐
  │     └── MP-6F (FE Terms)  │
  │           └── MP-6G (FE Billing)
  └── MP-6C (Billing) ────────┘
        └── MP-6D (DOKU)
              ├── MP-6E (WhatsApp)
              └── MP-6H (FE Payment)
MP-6I (Tests) — setelah semua backend phases
```

---

## 2026-03-03 - Data Model Update: Customer & Contract Fields

### Context

Update data model agar sesuai dengan kebutuhan operasional RTO yang sebenarnya.

### What was changed

**Customer Entity** - Added fields:
- `birthDate: string | null`, `gender: Gender | null`
- `rideHailingApps: string[]` (Grab, Gojek, Maxim, Indrive, Shopee, dll)
- `ktpPhoto`, `simPhoto`, `kkPhoto` (string | null)
- `guarantorName`, `guarantorPhone` (string)
- `guarantorKtpPhoto` (string | null)
- `spouseName` (string), `spouseKtpPhoto` (string | null)

**Contract Entity** - Added fields:
- `color` (string), `year` (number | null)
- `vinNumber` (string), `engineNumber` (string)

**New Enum**: `Gender` (MALE, FEMALE)

**Frontend:**
- Customer form: widened dialog with sections (Data Pribadi, Aplikasi Ojol toggles, Penjamin, Pasangan)
- Customer list: Aplikasi badges + Penjamin columns
- Customer detail: all new fields displayed
- Contract form: "Detail Unit" section
- Contract detail: unit details sub-section

### Tests: 111 tests (unchanged)

---

## 2026-03-03 - Bug Fixes, UX Improvements & Admin Controls

### What was changed

**Bug Fixes:**
1. **DP status not updating** — `applyPaymentToContract()` rewritten for DP/DP_INSTALLMENT types
2. **Late fee always applied** — Now only when `status === OVERDUE && billingStartDate exists`

**New Features:**
1. **BAST (Berita Acara Serah Terima)** — `bastPhoto` (mandatory) + `bastNotes` on Contract. Required for receiveUnit.
2. **Invoice Revert** (`PATCH /api/invoices/:id/revert`) — Revert PAID/VOID → PENDING. Auto-undoes contract changes.
3. **Terminology** — All "Invoice" → "Tagihan" in frontend
4. **Payment Status Summary** — Color-coded card at top of contract detail page
5. **Edit Customer** — Edit dialog on customer detail page

### Tests: 112 tests (up from 111)

---

## 2026-03-03 - Billing Accumulation, Calendar & State Refresh Fixes

### What was changed

**Bug 1: Billing Overdue Tidak Terakumulasi**
- `generateDailyBilling()` now processes ACTIVE and OVERDUE contracts
- Calculates accumulated unpaid working days
- Removed rollover logic from generateDailyBilling (only rolloverExpiredBillings handles it)

**Bug 2: Kalender Pembayaran Highlight Tanggal Salah**
- Added today check in getCalendarData() for active billing

**Bug 3: Frontend State Tidak Update**
- Added `refreshKey` prop on PaymentCalendar
- Added `calendarKey` state + `refreshAll()` helper in contract detail

### Tests: 114 tests (up from 112)

---

## 2026-03-03 - Payment Calendar Color Logic Fix

### Aturan Warna Kalender

| Warna | Status | Keterangan |
|-------|--------|------------|
| Hijau | `paid` | Sudah dibayar |
| Kuning | `pending` | Tagihan aktif, belum bayar (hari ini/mendatang) |
| Merah | `overdue` | Tanggal lewat dalam billing aktif |
| Biru | `holiday` | Libur bayar (Minggu) |
| Abu-abu | `not_issued` | Tagihan belum keluar |

### What was changed
- `getCalendarData()`: date < today → overdue, date >= today → pending, Sunday → holiday

### Tests: 114 tests (unchanged)

---

## 2026-03-03 - Calendar Coverage & Sunday-Aware EndDate Fix

### What was changed

1. **`creditDayToContract()`** — Sunday-aware endDate advancement. Working day credits iterate and skip Sundays.
2. **`getCalendarData()`** — Uses `contract.endDate` directly instead of calculating coveredEndDate.
3. **Seed data** — `billingStartDate` and `endDate` fixed for consistency with Sunday-aware logic. Added `advanceWorkingDays()` helper.

### Tests: 114 tests (unchanged)

---

## 2026-03-03 - Libur Bayar Logic Fix & Manual Billing as Active Billing

### What was changed

**Bug 1 — Libur Bayar:**
1. `getSundayHolidays(year, month, holidayDaysPerMonth)` — Picks evenly distributed Sundays
2. `isLiburBayar(contract, date)` — Only designated Sundays are Libur Bayar
3. Replaced all `isHoliday()` calls with `isLiburBayar()` throughout BillingService
4. Non-designated Sundays are regular working days requiring payment
5. Seed data updated with matching Libur Bayar algorithm

**Bug 2 — Manual Billing:**
1. `Billing.previousBillingId` — New field for merge/cancel tracking
2. `createManualBilling(contractId, days, adminId)` — Creates ACTIVE billing, merges if active exists
3. `cancelBilling(billingId, adminId)` — Cancels billing, reactivates previous if merged
4. Frontend: "Bayar Tagihan" creates billing instead of invoice, cancel button on merged billings

### Tests: 129 tests (up from 114)
- New: getSundayHolidays (3), isLiburBayar (3), createManualBilling (6), cancelBilling (5)

---

## 2026-03-03 - Phase 8: PostgreSQL + Prisma Migration

### Context

Migrated from in-memory Map-based repositories to PostgreSQL with Prisma ORM. Clean Architecture preserved — only infrastructure layer changed.

### What was built

**Prisma Schema** (`packages/backend/prisma/schema.prisma`):
- 7 models, 10 enums, all relations, indexes, unique constraints
- Snake_case columns/tables via `@map`/`@@map`
- `String[]` for rideHailingApps (native PG array), `Json` for metadata

**Prisma Client Singleton** (`packages/backend/src/infrastructure/prisma/client.ts`):
- Global singleton, conditional logging

**7 Prisma Repository Implementations**:
- PrismaSettingRepository, PrismaUserRepository, PrismaAuditLogRepository
- PrismaCustomerRepository, PrismaContractRepository, PrismaInvoiceRepository, PrismaBillingRepository
- Each: implements interface, `toEntity()` for type casting, parallel count+query for pagination

**Conditional Repo Initialization** (`packages/backend/src/index.ts`):
- `DATABASE_URL` → Prisma repos, no `DATABASE_URL` → InMemory repos
- Graceful shutdown with `prisma.$disconnect()`

**NOT Modified** (Clean Architecture preserved):
- All domain entities, interfaces, enums
- All application services, DTOs
- All presentation controllers, routes
- All tests (InMemory repos)
- All frontend code

### New Files

| File | Description |
|------|-------------|
| `packages/backend/prisma/schema.prisma` | Database schema |
| `packages/backend/prisma/seed.ts` | Production seed script |
| `packages/backend/src/infrastructure/prisma/client.ts` | Prisma singleton |
| `packages/backend/src/infrastructure/repositories/Prisma*.ts` | 7 Prisma repos |

### Tests: 129 tests (unchanged)

---

## 2026-03-04 - Scheduler Upgrade: node-cron

Replaced `setInterval` (24-hour interval, imprecise) with `node-cron`. Daily tasks now run at 00:01 WIB consistently. Still runs immediately on startup for catch-up.

### Dependencies Added
- `node-cron`, `@types/node-cron`

---

## 2026-03-04 - SDLC Git Branching Strategy & CI Setup

### Branching Strategy

```
develop/* ──PR──> staging ──PR──> main (production)
hotfix/*  ──PR──> main (+ backmerge ke staging)
chore/*   ──PR──> staging atau main
```

### What was built

1. **`.github/workflows/ci.yml`** — GitHub Actions: install, prisma generate, tsc, jest, build (Node 22)
2. **`.env.example` files** — Environment variable documentation
3. **Branch protection rules** — main + staging: PR required, CI must pass

### New Files

| File | Description |
|------|-------------|
| `.github/workflows/ci.yml` | CI workflow |
| `packages/backend/.env.example` | Backend env vars |
| `packages/frontend/.env.example` | Frontend env vars |

---

## 2026-03-04 - Frontend API Caching with SWR

### What was built

**SWR Provider** (`packages/frontend/src/components/SWRProvider.tsx`):
- Global config: revalidateOnFocus, dedupingInterval 2000ms, errorRetryCount 1

**Custom SWR Hooks** (`packages/frontend/src/hooks/useApi.ts`):
- TTL tiers: LONG (10min), MEDIUM (5min), DEFAULT (1min), SHORT (15sec)
- 17 hooks for all data types
- `useInvalidate()` — prefix-based cache invalidation

**Page Conversions** (11 pages):
- Replaced `useState + useEffect + loadData` with SWR hooks
- Mutations use `invalidate("/prefix")` instead of manual reload

**PaymentCalendar**: `useCalendarData` SWR hook, removed `refreshKey` prop

**CommandPalette**: `useCustomersList` + `useContractsList` SWR hooks

### Caching Behavior

| Scenario | Behavior |
|----------|----------|
| Navigate away & back | Cached data shown instantly, background revalidation |
| Mutation | `invalidate("/prefix")` force-refetches |
| Tab focus | Auto-refresh stale data |
| Page refresh | Cache cleared (in-memory) |
| Same data from 2 components | Single request (deduplication) |

### New Files

| File | Description |
|------|-------------|
| `frontend/src/components/SWRProvider.tsx` | Global SWR config |
| `frontend/src/hooks/useApi.ts` | All SWR hooks + invalidation |

### Dependencies Added
- `swr` (frontend)

### Tests: 129 tests (unchanged)

---

## 2026-03-05 - Seed Script Best Practices & "Lainnya" Ride-Hailing Apps

### What was changed

**Seed Script Rewrite (`packages/backend/prisma/seed.ts`):**

1. **Environment safeguard**: `--reset` in production requires `--force` flag
2. **Idempotent reference data**: Admin user and settings use `upsert`
3. **Skip if data exists**: Without `--reset`, checks `contract.count()`
4. **Static TypeScript data**: CSV → typed `.ts` files (compile-time safety)
5. **Removed `csv-parse` dependency**

**Data files:**
- `prisma/data/customers.ts` — 80 customers as typed array (`CustomerSeed` interface)
- `prisma/data/contracts.ts` — 79 contracts as typed array (`ContractSeed` interface, `DateTuple` type)

**"Lainnya" Ride-Hailing Apps (Frontend):**
1. Customer create form: "Lainnya" toggle → text input → removable chips
2. Customer edit dialog: same feature, existing custom values auto-populate
3. Predefined: Grab, Gojek, Maxim, Indrive, Shopee, Lalamove + "Lainnya"
4. No schema change — `rideHailingApps` is `String[]`

**Railway Auto-Seeding:**
- Updated `railway.json` startCommand: `prisma db push → prisma db seed → node dist/index.js`

### Seed Behavior per Environment

| Environment | Command | Behavior |
|-------------|---------|----------|
| Development | `npx prisma db seed` | Insert jika belum ada, skip jika sudah |
| Development | `npx prisma db seed -- --reset` | Hapus semua, insert ulang |
| Staging/Production | Auto-run setiap deploy | Idempotent skip |
| Production | `--reset` tanpa `--force` | DITOLAK |
| Production | `--reset --force` | Hapus semua, insert ulang |

### Menambah Data Seeding

1. Edit `prisma/data/customers.ts` atau `prisma/data/contracts.ts`
2. Ikuti interface `CustomerSeed` / `ContractSeed`
3. Format tanggal customers: ISO `"2001-08-25"`, contracts: tuple `[2025, 12, 30]`
4. Deploy + `--reset --force` jika data lama perlu diganti

### New Files

| File | Description |
|------|-------------|
| `packages/backend/prisma/data/customers.ts` | 80 customers typed array |
| `packages/backend/prisma/data/contracts.ts` | 79 contracts typed array |

### Modified Files

| File | Change |
|------|--------|
| `packages/backend/prisma/seed.ts` | Complete rewrite |
| `packages/backend/package.json` | Removed csv-parse |
| `packages/frontend/src/app/(dashboard)/customers/page.tsx` | "Lainnya" in create form |
| `packages/frontend/src/app/(dashboard)/customers/[id]/page.tsx` | "Lainnya" in edit dialog |
| `railway.json` | Added prisma db seed to startCommand |

### Tests: 129 tests (unchanged)

---

## 2026-03-05 - Documentation Restructure

### What was changed

Restructured documentation from single monolithic `CLAUDE.md` (1.965 lines) into 3 purpose-specific files:

| File | Purpose | Size |
|------|---------|------|
| `CLAUDE.md` | Prescriptive instructions for Claude AI | ~180 lines |
| `README.md` | Project documentation (tech stack, API, setup) | ~280 lines |
| `docs/CHANGELOG.md` | Development history per phase (this file) | ~800 lines |

**Rationale:**
- CLAUDE.md was consuming ~5.000 tokens of context window every session
- Most content (changelog) was rarely relevant to active tasks
- Separated concerns: instructions vs documentation vs history

---

## Development Roadmap

> Prinsip: Fungsionalitas dulu → Polish & UX → Infrastruktur & Produksi.

### Completed Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | COMPLETE | Full Stack Foundation (Express + Next.js + Clean Architecture) |
| 2 | COMPLETE | Enhancements & Testing (52 tests, detail pages, search/filter) |
| 3 | COMPLETE | Core RTO Mechanics (ownership, extension, repossession, grace period) |
| 4 | COMPLETE | Admin Controls (edit, cancel, void, mark-paid, soft delete, bulk) |
| 5 | COMPLETE | Financial Features & Reporting (late fee, reports, PDF, exports) |
| 5.5 | COMPLETE | Business Logic Audit (settings-driven, payment-gated, state machine) |
| 6 | COMPLETE | UX Polish (pagination, charts, forms, skeleton, command palette) |
| 6.5 MP-6A~6G | COMPLETE | RTO Business Model (DP, billing, rollover, Libur Bayar, frontend) |
| 8 | COMPLETE | PostgreSQL + Prisma Migration |
| 9 (partial) | COMPLETE | CI/CD pipeline, Git branching, SWR caching |

### Pending Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 6.5 MP-6D | PENDING | DOKU Payment Gateway integration |
| 6.5 MP-6E | PENDING | WhatsApp Reminder (depends on MP-6D) |
| 6.5 MP-6H | PENDING | Frontend Payment Gateway UI (depends on MP-6D) |
| 6.5 MP-6I | PENDING | Seed Data & Tests Update |
| 7 | PENDING | Security: JWT + bcrypt, RBAC, User Management, Sessions |
| 8 (remaining) | PENDING | File upload (KTP images), error monitoring, DB backup |
| 9 (remaining) | PENDING | Production deployment (Railway + Vercel), SSL, domain |

### Phase 7: Security & Authentication (Detail)

- JWT authentication with bcrypt (access + refresh token)
- Role-based access control: SUPER_ADMIN, ADMIN, VIEWER
- User management CRUD (SUPER_ADMIN only)
- Session management (logout all devices)
- Audit log: user tracking, IP logging, filter by user/action
