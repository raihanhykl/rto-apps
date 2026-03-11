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
- [Billing + Invoice Unification (2026-03-05)](#2026-03-05---billing--invoice-unification-into-unified-payment-pmt-xxx)
- [Holiday Scheme Overhaul (2026-03-06)](#2026-03-06---holiday-scheme-overhaul-holidayscheme-enum)
- [Fix: totalDaysPaid Seed Calculation (2026-03-06)](#2026-03-06---fix-totaldayspaid-seed-calculation-include-holidays)
- [Separate workingDaysPaid & holidayDaysPaid (2026-03-06)](#2026-03-06---separate-workingdayspaid--holidaydayspaid-fields)
- [PaymentDay: Static Per-Date Records (2026-03-09)](#2026-03-09---paymentday-static-per-date-records)
- [Saving Feature: Dana Sisihan Per Kontrak (2026-03-10)](#2026-03-10---saving-feature-dana-sisihan-per-kontrak)
- [Late Payment Penalty & Penalty Grace Days (2026-03-10)](#2026-03-10---late-payment-penalty--grace-period-2-hari)
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

## 2026-03-05 - Billing + Invoice Unification into Unified Payment (PMT-xxx)

### Context

Sistem sebelumnya punya 2 entitas terpisah: **Billing** (BIL-xxx, transient lifecycle: ACTIVE→PAID/EXPIRED/CANCELLED) dan **Invoice** (INV-xxx → PMT-xxx, record permanen). Flow terlalu kompleks — billing harus dibayar dulu, lalu sistem buat invoice baru. Refactor ini mengeliminasi Billing sepenuhnya. Semua pembayaran menggunakan satu entitas Invoice/Payment (PMT-xxx).

### What was changed

**Prisma Schema:**
- Hapus model `Billing` dan enum `BillingStatus`
- Tambah kolom ke `Invoice`: `dailyRate`, `daysCount`, `periodStart`, `periodEnd`, `expiredAt`, `previousPaymentId`, `isHoliday`
- Hapus kolom lama: `billingPeriodStart`, `billingPeriodEnd`, `billingId`
- Tambah self-relation `PaymentChain` untuk rollover tracking
- 7 models → 6 models, 10 enums → 9 enums

**Backend — Domain Layer:**
- Hapus: `Billing.ts` entity, `IBillingRepository.ts` interface, `BillingStatus` enum
- Update: `Invoice.ts` entity dengan field baru (dailyRate, daysCount, periodStart, periodEnd, expiredAt, previousPaymentId, isHoliday)

**Backend — Infrastructure:**
- Hapus: `InMemoryBillingRepository.ts`, `PrismaBillingRepository.ts`
- Update: `InMemoryInvoiceRepository.ts`, `PrismaInvoiceRepository.ts` — tambah `findActiveByContractId()`, `search()`, field mapping baru
- Update: `scheduler.ts` — dependency dari BillingService → PaymentService

**Backend — Application Layer:**
- Hapus: `BillingService.ts`, `InvoiceService.ts`
- Buat: `PaymentService.ts` — merge semua logic dari kedua service:
  - `generateDailyPayments()` — buat PMT-xxx PENDING (bukan Billing)
  - `rolloverExpiredPayments()` — expire dan buat akumulasi baru
  - `payPayment()` — PENDING → PAID, credit hari
  - `createManualPayment()` — manual 1-7 hari
  - `cancelPayment()` — void + reactivate previous
  - `voidPayment()`, `markPaid()`, `revertPaymentStatus()`, `bulkMarkPaid()`
  - `generateQRCode()`, `getCalendarData()`, `search()`
  - `getSundayHolidays()`, `isLiburBayar()`, `creditDayToContract()`
- Update: `ContractService.ts`, `DashboardService.ts`, `ReportService.ts` — hapus dependency billing

**Backend — Presentation:**
- Hapus: `BillingController.ts`, `InvoiceController.ts`
- Buat: `PaymentController.ts` — unified routes `/api/payments/*`
- Update: `routes/index.ts`

**Backend — Entry Point:**
- `index.ts` — hapus billing imports, buat PaymentService + PaymentController

**Frontend — Types:**
- Hapus: `BillingStatus` enum, `Billing` interface
- Update: `Invoice` interface — tambah field baru, hapus `billingPeriodStart/End/billingId`

**Frontend — API & Hooks:**
- `api.ts` — semua `/invoices/*` dan `/billings/*` → `/payments/*`
- `useApi.ts` — rename hooks: `usePaymentsPaginated`, `usePaymentsByContract`, `useActivePayment`

**Frontend — Pages:**
- `invoices/page.tsx` — gunakan `usePaymentsPaginated`, API calls ke `/payments`
- `contracts/[id]/page.tsx` — semua billing references → payment (variables, API calls, UI text)
- `customers/[id]/page.tsx` — `usePaymentsPaginated` ganti `useInvoicesByCustomer`
- `CommandPalette.tsx` — tambah pencarian PMT-xxx di global search (Ctrl+K)

**Seed Data:**
- `prisma/seed.ts` — hapus Billing references, buat Payment records langsung
- `infrastructure/seed.ts` — update field mapping

**Tests:**
- Hapus: `BillingService.test.ts`, `InvoiceService.test.ts`
- Buat: `PaymentService.test.ts` — merge semua test cases
- 5 suites → 4 suites, 129 tests → 127 tests (consolidation, not lost coverage)

### Files Deleted (8)

| File | Was |
|------|-----|
| `domain/entities/Billing.ts` | Billing entity |
| `domain/interfaces/IBillingRepository.ts` | Billing repo interface |
| `infrastructure/repositories/InMemoryBillingRepository.ts` | InMemory billing repo |
| `infrastructure/repositories/PrismaBillingRepository.ts` | Prisma billing repo |
| `application/services/BillingService.ts` | Billing service |
| `application/services/InvoiceService.ts` | Invoice service |
| `presentation/controllers/BillingController.ts` | Billing controller |
| `presentation/controllers/InvoiceController.ts` | Invoice controller |

### Files Created (2)

| File | Description |
|------|-------------|
| `application/services/PaymentService.ts` | Unified payment service (merge Billing + Invoice) |
| `presentation/controllers/PaymentController.ts` | Unified payment controller |

### Status Mapping

| Old (BillingStatus) | New (PaymentStatus) |
|---------------------|---------------------|
| ACTIVE | PENDING |
| PAID | PAID |
| EXPIRED | EXPIRED |
| CANCELLED | VOID |

### Tests: 127 tests, 4 suites (AuthService, CustomerService, ContractService, PaymentService)

---

## 2026-03-06 - Holiday Scheme Overhaul (HolidayScheme Enum)

### Context
Perubahan model bisnis Libur Bayar dari sistem "pilih N Minggu per bulan" (`holidayDaysPerMonth`) menjadi 2 tipe kontrak berbasis enum `HolidayScheme`:
- **OLD_CONTRACT**: Semua hari Minggu = Libur Bayar
- **NEW_CONTRACT**: Tanggal 29-31 = Libur Bayar (bayar hanya 1-28)

Perubahan interpretasi `ownershipTargetDays=1278`: sekarang SUDAH TERMASUK hari libur (sebelumnya pure hari bayar).

### What was changed

**Domain Layer:**
- Tambah enum `HolidayScheme { OLD_CONTRACT, NEW_CONTRACT }` + constant `DEFAULT_HOLIDAY_SCHEME`
- Hapus constants: `DEFAULT_HOLIDAY_DAYS_PER_MONTH`, `MIN_HOLIDAY_DAYS_PER_MONTH`, `MAX_HOLIDAY_DAYS_PER_MONTH`
- Entity `Contract`: ganti field `holidayDaysPerMonth: number` → `holidayScheme: HolidayScheme`

**Application Layer:**
- `PaymentService`: hapus `getSundayHolidays()`, rewrite `isLiburBayar()` dengan logic berbasis scheme
- `ContractService`: update `create()` untuk menerima `holidayScheme` dari DTO
- DTOs: tambah `holidayScheme` ke `CreateContractDto` dan `UpdateContractDto`

**Infrastructure Layer:**
- Prisma schema: tambah enum `HolidayScheme`, ganti field di model Contract
- `PrismaContractRepository`: update field mapping
- Seed data + scripts: semua helper functions dan data diupdate ke scheme baru

**Frontend:**
- Types: tambah enum `HolidayScheme`, update interface `Contract`
- Form create contract: tambah dropdown "Tipe Kontrak"
- Contract detail: tampilkan label scheme yang sesuai
- Schema: tambah validasi `holidayScheme`

**Tests:**
- Hapus test `getSundayHolidays`, rewrite test `isLiburBayar` untuk kedua scheme
- Tambah test holiday payment generation untuk NEW_CONTRACT
- Update semua test helpers dari `holidayDaysPerMonth` ke `holidayScheme`
- 129 tests passing

### Files modified
- `packages/backend/src/domain/enums/index.ts`
- `packages/backend/src/domain/entities/Contract.ts`
- `packages/backend/prisma/schema.prisma`
- `packages/backend/src/application/dtos/index.ts`
- `packages/backend/src/application/services/PaymentService.ts`
- `packages/backend/src/application/services/ContractService.ts`
- `packages/backend/src/infrastructure/repositories/PrismaContractRepository.ts`
- `packages/backend/src/infrastructure/seed.ts`
- `packages/backend/prisma/data/contracts.ts`
- `packages/backend/prisma/seed.ts`
- `packages/backend/src/__tests__/PaymentService.test.ts`
- `packages/backend/src/__tests__/ContractService.test.ts`
- `packages/frontend/src/types/index.ts`
- `packages/frontend/src/lib/schemas.ts`
- `packages/frontend/src/app/(dashboard)/contracts/page.tsx`
- `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx`
- `CLAUDE.md`

---

## 2026-03-06 - Fix: totalDaysPaid Seed Calculation (Include Holidays)

### Context
Setelah migrasi HolidayScheme, ditemukan bahwa `totalDaysPaid` di seed data hanya menghitung hari kerja (working days), padahal model baru mensyaratkan `ownershipTargetDays=1278` sudah termasuk hari libur. Contoh: customer dengan 50 hari kerja + 9 hari Minggu libur seharusnya punya `totalDaysPaid=59`.

### What was changed
- **Seed data interface**: Rename `totalDaysPaid` → `workingDaysPaid` di `ContractSeed` untuk kejelasan (data = working days only)
- **Prisma seed script**: Tambah `countCalendarDays()` helper yang walk kalender dari billingStartDate, hitung working + holiday days. Fix perhitungan `totalDaysPaid` (now includes holidays), `endDate`, `totalAmount` (working days only × rate), `ownershipProgress`. Fix daily payment loop: walk calendar days instead of linear count.
- **InMemory seed script**: Sama — tambah `countCalendarDays()`, fix semua perhitungan contract fields.

### Files modified
- `packages/backend/prisma/data/contracts.ts` — rename field di interface + 79 entries
- `packages/backend/prisma/seed.ts` — `countCalendarDays()`, fix `seedContracts()`
- `packages/backend/src/infrastructure/seed.ts` — `countCalendarDays()`, fix contract calculation

---

## 2026-03-06 - Separate workingDaysPaid & holidayDaysPaid Fields

### Context
`totalDaysPaid` menggabungkan hari kerja + hari libur jadi satu angka, membingungkan admin karena tidak bisa lihat breakdown berapa hari customer benar-benar bayar vs berapa hari gratis (libur). Ditambahkan 2 field baru agar informasi terpisah jelas.

### What was changed
- **Prisma schema**: Tambah kolom `working_days_paid` dan `holiday_days_paid` (default 0)
- **Domain entity**: Tambah `workingDaysPaid` dan `holidayDaysPaid` di Contract interface
- **PaymentService**: `creditDayToContract()` sekarang update field yang sesuai berdasarkan `isHoliday`. `revertPaymentFromContract()` kurangi `workingDaysPaid` saat revert.
- **ContractService**: Set field baru ke 0 saat create contract
- **Seed scripts**: Set `workingDaysPaid` dan `holidayDaysPaid` dari `countCalendarDays()` hasil (kedua Prisma dan InMemory)
- **PrismaContractRepository**: Include field baru di create
- **ReportService**: Tambah kolom di CSV dan XLSV export
- **Frontend types**: Tambah field baru di Contract interface
- **Frontend UI**: Contract detail menampilkan breakdown: "Hari Kerja Dibayar", "Hari Libur (Gratis)", "Total Hari", "Sisa Hari"
- **Tests**: Update test helpers dengan field baru, 129 tests passing

### Files modified
- `packages/backend/prisma/schema.prisma`
- `packages/backend/src/domain/entities/Contract.ts`
- `packages/backend/src/application/services/PaymentService.ts`
- `packages/backend/src/application/services/ContractService.ts`
- `packages/backend/src/application/services/ReportService.ts`
- `packages/backend/prisma/seed.ts`
- `packages/backend/src/infrastructure/seed.ts`
- `packages/backend/src/infrastructure/repositories/PrismaContractRepository.ts`
- `packages/backend/src/__tests__/PaymentService.test.ts`
- `packages/frontend/src/types/index.ts`
- `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx`

---

## 2026-03-09 - PaymentDay: Static Per-Date Records

### Context
Sistem kalender pembayaran sebelumnya menghitung status per-tanggal secara **dinamis** di `getCalendarData()`. Ini punya kelemahan: gap hari tidak terekam, holiday dihitung ulang tiap request (retroaktif), admin tidak bisa koreksi tanggal tertentu, dan tidak ada jejak audit per-tanggal.

### What was built
- **PaymentDay model**: Record eksplisit per-tanggal per-kontrak dengan status UNPAID, PENDING, PAID, HOLIDAY, VOIDED
- **Gap Billing (Opsi B)**: Akumulasi semua hari UNPAID dari `billingStartDate` sampai hari ini ke satu invoice
- **Partial Payment**: Admin bisa reduce jumlah hari dalam invoice aktif; sisa hari kembali ke UNPAID
- **Admin Correction**: Override status PaymentDay individual (UNPAID ↔ HOLIDAY ↔ PAID) dengan audit log
- **Calendar rewrite**: `getCalendarData()` sekarang query PaymentDay records (bukan kalkulasi dinamis)
- **Contract sync**: `syncContractFromPaymentDays()` — recalculate contract summary dari PaymentDay data
- **Auto-extend**: Scheduler extend 30 hari PaymentDay records ke depan untuk kontrak aktif
- **Data Migration**: `migrateExistingContracts()` untuk backfill kontrak yang sudah berjalan

### Architecture
- Domain layer: `PaymentDayStatus` enum, `PaymentDay` entity, `IPaymentDayRepository` interface (13 methods)
- Infrastructure: `InMemoryPaymentDayRepository` (Map-based) + `PrismaPaymentDayRepository` (Prisma)
- Application: 14 sub-changes di PaymentService, 4 sub-changes di ContractService
- Presentation: 2 endpoint baru (PATCH day status, POST reduce payment)
- Frontend: voided status di kalender, 2 API methods baru
- Shared utility: `toDateKey()` dipindah ke `domain/utils/dateUtils.ts`

### API Endpoints (New)
| Method | Route | Description |
|--------|-------|-------------|
| PATCH | `/payments/contract/:contractId/day/:date` | Admin correction — ubah status PaymentDay |
| POST | `/payments/:id/reduce` | Partial payment — kurangi hari dalam invoice |

### Files modified
- `packages/backend/prisma/schema.prisma` — PaymentDayStatus enum + PaymentDay model + relasi
- `packages/backend/src/domain/enums/index.ts` — PaymentDayStatus enum
- `packages/backend/src/domain/entities/PaymentDay.ts` — **Baru** (interface)
- `packages/backend/src/domain/entities/index.ts` — export
- `packages/backend/src/domain/interfaces/IPaymentDayRepository.ts` — **Baru** (13 methods)
- `packages/backend/src/domain/interfaces/index.ts` — export
- `packages/backend/src/domain/utils/dateUtils.ts` — toDateKey() function
- `packages/backend/src/infrastructure/repositories/InMemoryPaymentDayRepository.ts` — **Baru**
- `packages/backend/src/infrastructure/repositories/PrismaPaymentDayRepository.ts` — **Baru**
- `packages/backend/src/infrastructure/repositories/index.ts` — exports
- `packages/backend/src/index.ts` — wiring paymentDayRepo
- `packages/backend/src/application/services/PaymentService.ts` — 14 sub-changes (gap billing, PaymentDay CRUD, calendar rewrite, reduce, migration)
- `packages/backend/src/application/services/ContractService.ts` — 4 sub-changes (receiveUnit, cancel, repossess)
- `packages/backend/src/presentation/controllers/PaymentController.ts` — 2 new methods
- `packages/backend/src/presentation/routes/index.ts` — 2 new routes
- `packages/backend/src/infrastructure/scheduler.ts` — extendPaymentDayRecords step
- `packages/backend/src/__tests__/PaymentService.test.ts` — 17+ new test cases
- `packages/backend/src/__tests__/ContractService.test.ts` — updated setup
- `packages/frontend/src/types/index.ts` — PaymentDayStatus enum
- `packages/frontend/src/components/PaymentCalendar.tsx` — voided status + legend
- `packages/frontend/src/lib/api.ts` — 2 new API methods

### Test count: 146 tests (4 suites)

---

## 2026-03-10 - Saving Feature: Dana Sisihan Per Kontrak

### Context
Fitur saving otomatis menyisihkan Rp 5.000 per hari kerja dari setiap pembayaran harian customer. Dana saving disimpan per kontrak dan bisa digunakan untuk servis motor, balik nama STNK/BPKB, atau di-claim customer setelah kontrak selesai (COMPLETED).

### What was built

**Prisma Schema:**
- Enum `SavingTransactionType` (CREDIT, DEBIT_SERVICE, DEBIT_TRANSFER, DEBIT_CLAIM, REVERSAL)
- Model `SavingTransaction` (15 fields, 3 indexes: contractId, paymentId, type)
- Field `savingBalance Int @default(0)` di Contract
- Relasi `savingTransactions` di Contract dan Invoice

**Domain Layer:**
- Entity `SavingTransaction` (immutable — no update/delete)
- Interface `ISavingTransactionRepository` (6 methods: findById, findByContractId, findByPaymentId, findByContractAndType, create, count)
- Enum `SavingTransactionType` + constant `SAVING_PER_DAY = 5000`
- Field `savingBalance` di Contract entity

**Infrastructure Layer:**
- `InMemorySavingTransactionRepository` (Map-based, untuk dev/test)
- `PrismaSavingTransactionRepository` (PostgreSQL, untuk production)

**Application Layer:**
- `SavingService` (8 methods): creditFromPayment, reverseCreditFromPayment, debitForService, debitForTransfer, claimSaving, getBalance, getTransactionHistory, recalculateBalance
- DTOs: `DebitSavingDto`, `ClaimSavingDto` (Zod schemas)
- Integrasi PaymentService: auto-credit saving saat payment PAID, auto-reverse saat payment revert (try-catch — saving error tidak gagalkan payment)
- Setter injection `setSavingService()` di PaymentService untuk hindari circular dependency

**Presentation Layer:**
- `SavingController` (6 endpoint handlers)
- 6 API routes:
  - `GET /api/savings/contract/:contractId` — Data saving (balance + transactions)
  - `GET /api/savings/contract/:contractId/balance` — Balance only
  - `POST /api/savings/contract/:contractId/debit-service` — Debit untuk servis motor
  - `POST /api/savings/contract/:contractId/debit-transfer` — Debit untuk balik nama
  - `POST /api/savings/contract/:contractId/claim` — Claim sisa saving
  - `POST /api/savings/contract/:contractId/recalculate` — Recalculate balance

**Frontend:**
- Types: `SavingTransactionType` enum, `SavingTransaction` & `SavingData` interfaces
- API client: 6 methods di `api.ts`
- SWR hooks: `useSavingByContract`, `useSavingBalance` (TTL.SHORT)
- Zod schemas: `debitSavingSchema`, `claimSavingSchema`
- Contract detail page: kartu saldo saving, tombol aksi (Servis/Balik Nama/Claim), riwayat transaksi dengan pagination, 3 dialog forms

**Tests:**
- `SavingService.test.ts`: 31 test cases (credit, debit service, debit transfer, claim, reversal, history, recalculate, full flow)

### Business rules
- CREDIT hanya dari hari kerja (bukan holiday, bukan DP)
- DEBIT_SERVICE: contract ACTIVE/OVERDUE/COMPLETED, amount ≤ savingBalance
- DEBIT_TRANSFER: contract HARUS COMPLETED
- DEBIT_CLAIM: contract HARUS COMPLETED (bukan CANCELLED/REPOSSESSED)
- REVERSAL: otomatis saat payment revert, saldo tidak boleh negatif
- `savingBalance` di Contract = denormalized (source of truth = SavingTransaction records)

### Files modified
- `packages/backend/prisma/schema.prisma`
- `packages/backend/src/domain/enums/index.ts`
- `packages/backend/src/domain/entities/SavingTransaction.ts` (NEW)
- `packages/backend/src/domain/entities/Contract.ts`
- `packages/backend/src/domain/entities/index.ts`
- `packages/backend/src/domain/interfaces/ISavingTransactionRepository.ts` (NEW)
- `packages/backend/src/domain/interfaces/index.ts`
- `packages/backend/src/infrastructure/repositories/InMemorySavingTransactionRepository.ts` (NEW)
- `packages/backend/src/infrastructure/repositories/PrismaSavingTransactionRepository.ts` (NEW)
- `packages/backend/src/infrastructure/repositories/index.ts`
- `packages/backend/src/infrastructure/seed.ts`
- `packages/backend/src/application/dtos/index.ts`
- `packages/backend/src/application/services/SavingService.ts` (NEW)
- `packages/backend/src/application/services/PaymentService.ts`
- `packages/backend/src/application/services/ContractService.ts`
- `packages/backend/src/application/services/index.ts`
- `packages/backend/src/presentation/controllers/SavingController.ts` (NEW)
- `packages/backend/src/presentation/routes/index.ts`
- `packages/backend/src/index.ts`
- `packages/backend/src/__tests__/SavingService.test.ts` (NEW)
- `packages/backend/src/__tests__/PaymentService.test.ts`
- `packages/frontend/src/types/index.ts`
- `packages/frontend/src/lib/api.ts`
- `packages/frontend/src/hooks/useApi.ts`
- `packages/frontend/src/lib/schemas.ts`
- `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx`

### Test count: 177 tests (5 suites)

---

## 2026-03-10 - Late Payment Penalty & Grace Period 2 Hari

### Context

Kebijakan perusahaan baru: denda keterlambatan Rp 20.000/hari (naik dari Rp 10.000). Denda berlaku setelah 2 hari toleransi (`penalty_grace_days`). Setting ini **terpisah** dari `grace_period_days` (7 hari, untuk status OVERDUE).

### What was changed

**Business Logic:**
- Setting baru: `penalty_grace_days` (default 2) — toleransi sebelum denda berlaku
- `grace_period_days` tetap 7 — hanya untuk status OVERDUE (konsep berbeda dari penalty)
- Denda per hari: Rp 10.000 → Rp 20.000 (`DEFAULT_LATE_FEE_PER_DAY`, setting `late_fee_per_day`)
- Denda otomatis dihitung saat pembuatan invoice (scheduler, manual, rollover, reduce, extension)
- Field `Invoice.lateFee` diisi dengan total denda (sebelumnya selalu 0 untuk billing harian)
- `amount` tetap hanya berisi tarif harian, `lateFee` terpisah. Total bayar = `amount + lateFee`

**Architecture Improvement:**
- Pure function `computeLateFee()` di `domain/utils/lateFeeCalculator.ts` — shared antara PaymentService & ContractService (DRY, no duplication)
- `PaymentService.calculateLateFee()` adalah async wrapper yang baca setting lalu delegasi ke `computeLateFee()`
- Dead code `createDailyPayment()` dihapus dari PaymentService
- `SettingService.migrateSettings()` — otomatis update setting lama yang belum dikustomisasi admin ke nilai baru saat deploy

**Methods diubah di PaymentService:**
- Baru: `getSetting()`, `calculateLateFee()` — wrapper ke `computeLateFee()`
- `generateDailyPayments()` — hitung late fee saat buat gap billing
- `rolloverPayment()` — hitung late fee saat rollover
- `createManualPayment()` — hitung late fee saat admin buat billing manual
- `reducePayment()` — hitung late fee saat reduce payment

**ContractService.extend():**
- Duplikasi logika dihapus, diganti `computeLateFee()` shared utility

### Files modified

| File | Perubahan |
|------|-----------|
| `src/domain/enums/index.ts` | `DEFAULT_GRACE_PERIOD_DAYS=7` (tetap), tambah `DEFAULT_PENALTY_GRACE_DAYS=2`, `DEFAULT_LATE_FEE_PER_DAY=20000` |
| `src/domain/utils/lateFeeCalculator.ts` | **Baru** — pure function `computeLateFee()` |
| `src/application/services/PaymentService.ts` | Refactor `calculateLateFee()` → delegasi ke `computeLateFee()`, hapus dead code `createDailyPayment()` |
| `src/application/services/ContractService.ts` | Hapus duplikasi, import `computeLateFee()` |
| `src/application/services/SettingService.ts` | Tambah `penalty_grace_days` setting, tambah `migrateSettings()` |
| `src/__tests__/PaymentService.test.ts` | Tambah 15 tests untuk late fee/penalty |

### Test count

192 tests (5 suites) — naik dari 177 (tambah 15 tests late fee/penalty)

---

## 2026-03-11 — Fix: endDate Loncat & Banner Status Tidak Akurat

### Context

Dua bug kritis ditemukan setelah implementasi late payment penalty:
1. `endDate` kontrak loncat ke akhir bulan (misal 31 Maret) setelah pembayaran — progress dan sisa hari menjadi tidak akurat
2. Banner status di detail kontrak salah: (a) hijau "Pembayaran Lancar" padahal masih ada tunggakan, (b) OVERDUE tidak pernah revert ke ACTIVE setelah pembayaran

### Root Cause

1. **endDate loncat**: `syncContractFromPaymentDays()` menggunakan `findLastPaidOrHolidayDate()` yang me-return tanggal MAX dari SEMUA record PAID/HOLIDAY — termasuk HOLIDAY yang sudah di-pre-generate 30-60 hari ke depan oleh scheduler. Untuk NEW_CONTRACT, tanggal 29-31 = HOLIDAY, sehingga endDate loncat ke 31 Maret meskipun customer baru bayar sampai 5 Maret.

2. **Banner hijau padahal tunggakan**: Frontend hanya cek `activePayment` (ada invoice PENDING?) dan `contract.status`. Setelah bayar sebagian, activePayment = null tapi masih ada hari UNPAID → fallthrough ke hijau.

3. **OVERDUE tidak revert**: `payPayment()` → `syncContractFromPaymentDays()` update endDate tapi TIDAK cek status. `checkAndUpdateOverdueContracts()` di ContractService hanya unidirectional: ACTIVE → OVERDUE.

### What was changed

**Backend — `syncContractFromPaymentDays()` rewrite (PaymentService.ts):**
- **Contiguous walk algorithm**: Fetch semua PaymentDay records sorted ASC, walk dari billingStartDate. Hitung PAID + HOLIDAY yang berturut-turut. Berhenti di gap pertama (UNPAID/PENDING/VOIDED). Trailing contiguous holidays setelah PAID terakhir tetap dihitung (konsisten dengan seed `countCalendarDays()`).
- **Bidirectional status transition**: Setelah hitung endDate baru, cek apakah status perlu berubah:
  - OVERDUE → ACTIVE jika `(endDate + gracePeriodDays) >= today`
  - ACTIVE → OVERDUE jika `(endDate + gracePeriodDays) < today`
  - Terminal statuses (COMPLETED, CANCELLED, REPOSSESSED) tidak diubah

**Backend — `createHolidayPayment()` consistency:**
- Ganti `creditDayToContract(contract, 1, true)` (aritmatika incremental) dengan `syncContractFromPaymentDays(contract.id)` (contiguous walk) untuk konsistensi
- Hapus dead code `creditDayToContract()` (tidak dipanggil dari manapun lagi)

**Frontend — Banner "Ada Tunggakan" (orange):**
- Tambah state intermediate di banner logic: jika contract ACTIVE, tidak ada activePayment, tapi `endDate < today` → orange "Ada Tunggakan" dengan info "Terakhir bayar: {date}"
- Tambah helper `getWibToday()` di `lib/utils.ts` (mirror backend `getWibToday()` untuk konsistensi timezone WIB)

### Files modified

| File | Perubahan |
|------|-----------|
| `src/application/services/PaymentService.ts` | Rewrite `syncContractFromPaymentDays()` (contiguous walk + bidirectional status), ganti `creditDayToContract()` di `createHolidayPayment()`, hapus dead code |
| `src/__tests__/PaymentService.test.ts` | Fix holiday test setup, tambah 6 tests baru (contiguous walk, status transitions) |
| `frontend/src/app/(dashboard)/contracts/[id]/page.tsx` | Tambah banner "Ada Tunggakan" (orange) |
| `frontend/src/lib/utils.ts` | Tambah `getWibToday()` helper |

### Test count

198 tests (5 suites) — naik dari 192 (tambah 6 tests contiguous walk + status transitions)

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
