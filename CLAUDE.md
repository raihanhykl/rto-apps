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
| PATCH | /api/invoices/:id/void | Void invoice |
| PATCH | /api/invoices/:id/mark-paid | Manual mark paid |
| POST | /api/invoices/bulk-pay | Bulk mark invoices as paid |
| GET | /api/invoices/:id/pdf | Download invoice as PDF |
| PUT | /api/contracts/:id | Edit contract |
| PATCH | /api/contracts/:id/cancel | Cancel contract |
| DELETE | /api/contracts/:id | Soft delete contract |
| POST | /api/contracts/:id/extend | Extend contract |
| PATCH | /api/contracts/:id/repossess | Repossess motor |
| GET | /api/contracts/overdue-warnings | Get overdue warnings |
| GET | /api/reports | Get report data (supports filters) |
| GET | /api/reports/export/json | Export report as JSON |
| GET | /api/reports/export/csv | Export report as CSV |
| GET | /api/reports/export/xlsv | Export report as Excel (TSV) |
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

9. **Updated Seed Data** - 9 contract scenarios with RTO model:
   - Contracts with multiple extension invoices
   - Various progress levels
   - Overdue and repossessed examples

10. **Unit Tests** - 64 tests (up from 52):
    - New tests for extend, repossess, ownership progress, RTO fields
    - Updated InvoiceService tests for RTO model

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

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/contracts/:id/extend | Extend contract (max 7 days) |
| PATCH | /api/contracts/:id/repossess | Repossess motor |
| GET | /api/contracts/overdue-warnings | Get overdue/near-overdue contracts |

### Phase 3 Status

- [x] Remodel kontrak sebagai RTO
- [x] Perpanjangan sewa (Top-Up / Extend)
- [x] Penarikan motor (Repossession)
- [x] Grace period & overdue logic
- [x] Ownership completion
- [x] Updated seed data with RTO model
- [x] Updated unit tests (64 tests passing)
- [x] Frontend: progress bar, extend dialog, repossess dialog

### Phase 3 Bugfixes (2026-02-28)

**Extension payment-gated logic:**
- Invoice entity now has `extensionDays: number | null` field
- `ContractService.extend()` no longer updates contract fields immediately — it only creates an invoice with `extensionDays` set
- `InvoiceService.simulatePayment()` now applies extension (durationDays, totalDaysPaid, endDate, ownershipProgress, totalAmount) to contract only when the extension invoice is successfully PAID
- Failed payment does NOT extend the contract (fixes bug where endDate extended even on failed payment)
- `durationDays` now accumulates (initial + extensions) instead of being overwritten (fixes "Periode aktif stuck" bug)

**QR button receipt view:**
- Paid invoices: QR button shows "Bukti" (receipt) instead of "QR"
- Receipt dialog shows: payment success banner, invoice details, extension days info, small reference QR
- Both contract detail page and invoices list page updated

**Contracts list - Sisa Hari column:**
- New "Sisa Hari" column shows remaining days before endDate
- Color-coded: red for overdue ("Lewat X hari"), yellow for ≤2 days, normal otherwise
- Shows "-" for completed/cancelled/repossessed contracts

**Invoices list - No. Kontrak column:**
- New "No. Kontrak" column maps invoice to contract number
- Search now includes contract number matching

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
   - Full audit logging

3. **Void Invoice** (`PATCH /api/invoices/:id/void`):
   - Sets invoice status to `VOID`
   - Rejects already paid or voided invoices
   - `PaymentStatus.VOID` added to enums

4. **Mark Paid** (`PATCH /api/invoices/:id/mark-paid`):
   - Manual payment marking (bypasses payment simulation)
   - Applies extension to contract if invoice has extensionDays (same logic as simulatePayment)
   - Rejects already paid or voided invoices
   - Audit log includes `manual: true` flag

5. **Customer Delete Validation**:
   - CustomerService now accepts optional IContractRepository
   - Cannot delete customer with active/overdue contracts

6. **Unit Tests**: 86 tests passing (up from 67)
   - 9 new tests for editContract (notes, grace period, ownership target, not found)
   - 5 new tests for cancelContract (active, completed reject, already cancelled, repossessed reject, append notes)
   - 5 new tests for voidInvoice (void pending, reject paid, reject already void, not found, audit log)
   - 5 new tests for markPaid (mark pending, apply extension, reject paid, reject void, audit log)

**Frontend:**

1. **Contract Detail Page - Edit Dialog**:
   - Edit notes, grace period, ownership target
   - Live preview of new progress percentage
   - Pencil icon edit button in header

2. **Contract Detail Page - Cancel Dialog**:
   - Required reason textarea
   - Orange-themed warning UI
   - Contract info summary

3. **Contract Detail Page - Invoice Actions**:
   - "Void" button on PENDING and FAILED invoices (with confirmation dialog)
   - "Tandai Lunas" (mark paid) button on FAILED invoices (with confirmation dialog)
   - VOID status badge (secondary variant)

4. **Invoices Page**:
   - VOID status badge variant
   - VOID option in status filter dropdown

5. **API Client**: Added `editContract()`, `cancelContract()`, `voidInvoice()`, `markInvoicePaid()`

6. **Types**: Added `VOID` to `PaymentStatus` enum

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| PUT | /api/contracts/:id | Edit contract (notes, grace period, ownership target) |
| PATCH | /api/contracts/:id/cancel | Cancel contract with reason |
| PATCH | /api/invoices/:id/void | Void an invoice |
| PATCH | /api/invoices/:id/mark-paid | Manual mark invoice as paid |

### Phase 4 Status

- [x] Edit kontrak (PUT + frontend dialog)
- [x] Cancel/terminate kontrak (PATCH + frontend dialog)
- [x] Edit invoice (VOID + manual mark paid)
- [x] Customer delete validation (active contracts check)
- [x] Confirmation dialogs for destructive operations
- [x] Unit tests (86 tests, 4 suites)
- [x] Soft delete kontrak (DELETE /api/contracts/:id, isDeleted + deletedAt fields)
- [x] Bulk operations (POST /api/invoices/bulk-pay)

---

## 2026-03-01 - Phase 5: Financial Features & Reporting

### What was built

**Backend:**

1. **Late Fee Field** - `lateFee: number` added to Invoice entity
   - `late_fee_per_day` setting added (default Rp 10,000/day)
   - Field tracked in all invoice creation (initial + extension)
   - Revenue calculations include lateFee

2. **Enhanced Reports** (`ReportService` complete rewrite):
   - `ReportFilters` interface: `startDate`, `endDate`, `status`, `motorModel`
   - `contractsByStatus` breakdown
   - `revenueByMotor` per model
   - `revenueByMonth` (last 6 months)
   - `topCustomers` (top 10 by total paid)
   - `overdueCount`, `averageOwnershipProgress`
   - Filters out soft-deleted contracts

3. **Export Improvements**:
   - XLSV export (tab-separated, Excel-compatible) with multiple sections
   - Route: `GET /api/reports/export/xlsv`
   - CSV and JSON exports now support filters

4. **PDF Invoice Generation** (`PdfService`):
   - Uses pdfkit library
   - Full A4 invoice: WEDISON header, customer info, line items, total, payment status, ownership progress, optional QR code
   - Route: `GET /api/invoices/:id/pdf`
   - Returns downloadable PDF buffer

**Frontend:**

1. **Enhanced Reports Page** (complete rewrite):
   - Filter panel: date range, contract status, motor model
   - Summary cards: total contracts, revenue, pending amount, avg ownership progress
   - Contracts by status bar chart (CSS-based)
   - Revenue by motor model bar chart
   - Revenue by month chart (last 6 months)
   - Top customers table
   - Export buttons: JSON, CSV, Excel (XLSV)

2. **Payment Timeline** on Contract Detail Page:
   - Vertical timeline showing all paid invoices chronologically
   - Shows payment type (initial vs extension), date, and amount
   - Green dot markers on timeline axis

3. **PDF Download**:
   - PDF download button on each invoice (contract detail page)
   - PDF download button on invoices list page
   - Downloads as `invoice-{number}.pdf`

4. **Frontend Types Updated**:
   - `lateFee: number` added to Invoice interface
   - `ReportData` interface with full summary structure

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/invoices/:id/pdf | Download invoice as PDF |
| GET | /api/reports/export/xlsv | Export report as Excel-compatible TSV |
| DELETE | /api/contracts/:id | Soft delete contract |
| POST | /api/invoices/bulk-pay | Bulk mark invoices as paid |

### New Files

- `packages/backend/src/application/services/PdfService.ts`

### Phase 5 Status

- [x] Payment history timeline (contract detail page)
- [x] Denda keterlambatan (late fee field + setting, calculation deferred)
- [x] Enhanced reports (filters, status breakdown, revenue by motor/month, top customers)
- [x] PDF invoice generation (pdfkit, full invoice with QR)
- [x] Export improvements (XLSV/Excel export, filters on all exports)
- [ ] Revenue dashboard enhancements (deferred to Phase 6 with charts library)
- [x] Late fee auto-calculation logic (implemented in Phase 5.5)

---

## 2026-03-01 - Phase 5.5: Business Logic Audit & Refinement

### Context

Comprehensive audit of Phase 1-5 logic to fix MVP/dummy behaviors that don't match real-world business requirements. ~20 issues identified and fixed across 7 batches.

### What was changed

**Backend - Core Logic Fixes:**

1. **Settings-driven configuration** (`SettingService`, `ContractService`):
   - Added `getNumberSetting(key, fallback)` helper to `SettingService`
   - `ContractService` now reads `max_rental_days`, `ownership_target_days`, `grace_period_days`, `late_fee_per_day` from settings at runtime
   - Injected `SettingService` as optional 5th param in `ContractService` constructor

2. **Payment-gated ownership** (`ContractService`, `InvoiceService`):
   - Contract creation now sets `totalDaysPaid: 0`, `ownershipProgress: 0` (not pre-credited)
   - Initial invoice has `extensionDays: dto.durationDays` so paying it credits days via `applyPaymentToContract()`
   - Initial payment only updates `totalDaysPaid`/`ownershipProgress` (not `durationDays`/`totalAmount`/`endDate` which are already correct)
   - Extension payments update all fields including duration and amount

3. **Late fee calculation** (`ContractService.extend()`):
   - Calculates `lateFee = daysOverdue * lateFeePerDay` when contract is overdue
   - `InMemoryInvoiceRepository.sumByStatus()` includes `lateFee` in sum

4. **State machine enforcement** (`enums/index.ts`, `ContractService`):
   - Added `VALID_STATUS_TRANSITIONS` map (terminal: COMPLETED, CANCELLED, REPOSSESSED)
   - `updateStatus()` validates transitions
   - Auto-void PENDING/FAILED invoices on `cancelContract()` and `repossess()`
   - `extend()` blocked when PENDING invoices exist on contract
   - `checkAndUpdateOverdueContracts()` uses `gracePeriodDays` (grace period must expire before OVERDUE)
   - Audit log created for automated overdue transitions

5. **Sequential numbering** (`ContractService`):
   - Contract/invoice numbers use static counters (`RTO-YYMMDD-NNNN`, `INV-YYMMDD-NNNN`)

6. **Shared payment logic** (`InvoiceService`):
   - Extracted `applyPaymentToContract()` private method used by both `simulatePayment()` and `markPaid()`
   - Handles initial vs extension payments correctly (no double-counting)

7. **Customer soft delete** (`Customer.ts`, `CustomerService`, `InMemoryCustomerRepository`):
   - Added `isDeleted`, `deletedAt` to Customer entity
   - `delete()` now soft-deletes; `findAll()`, `search()`, `count()` filter deleted
   - Phone regex validation: `/^(\+62|62|0)8[0-9]{8,12}$/`
   - KTP digits-only validation: `/^\d{16}$/`

8. **Repository filtering** (`InMemoryContractRepository`):
   - `findByCustomerId()`, `findByStatus()`, `countByStatus()`, `count()` filter `isDeleted`

**Frontend Fixes:**

1. **Late fee display**: `amount + lateFee` shown in invoices across all pages
2. **Timeline label**: Uses `invoice.extensionDays` instead of `contract.durationDays`
3. **Motor rates from backend**: `GET /api/settings/rates` endpoint; contract form fetches rates dynamically
4. **Error toasts**: Replaced `console.error` catch blocks with `toastError()` in PDF, QR, export operations
5. **Invoices page actions**: Added pay/void/mark-paid buttons with confirmation dialogs

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/settings/rates | Get motor daily rates |

### Modified Files

- `packages/backend/src/application/services/SettingService.ts`
- `packages/backend/src/application/services/ContractService.ts` (rewritten)
- `packages/backend/src/application/services/InvoiceService.ts` (rewritten)
- `packages/backend/src/application/services/CustomerService.ts`
- `packages/backend/src/application/dtos/index.ts`
- `packages/backend/src/domain/entities/Customer.ts`
- `packages/backend/src/domain/enums/index.ts`
- `packages/backend/src/infrastructure/repositories/InMemoryContractRepository.ts`
- `packages/backend/src/infrastructure/repositories/InMemoryCustomerRepository.ts`
- `packages/backend/src/infrastructure/repositories/InMemoryInvoiceRepository.ts`
- `packages/backend/src/infrastructure/seed.ts` (rewritten)
- `packages/backend/src/presentation/routes/index.ts`
- `packages/backend/src/index.ts`
- `packages/frontend/src/app/(dashboard)/contracts/page.tsx`
- `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx`
- `packages/frontend/src/app/(dashboard)/invoices/page.tsx`
- `packages/frontend/src/app/(dashboard)/customers/[id]/page.tsx`
- `packages/frontend/src/lib/api.ts`
- `packages/frontend/src/types/index.ts`

### Tests

- 88 tests passing (4 suites, up from 86)
- Updated all test expectations for payment-gated logic
- New tests: invalid status transitions, extension blocking, auto-void on cancel/repossess

---

## 2026-03-02 - Phase 6: UX Polish & Frontend Improvements

### What was built

**Backend:**

1. **Pagination Infrastructure** (`Pagination.ts`, all repos/services/controllers):
   - `PaginationParams` interface: page, limit, sortBy, sortOrder, search, status, dates, module, customerId
   - `PaginatedResult<T>`: data, total, page, limit, totalPages
   - `findAllPaginated()` added to 4 repository interfaces + implementations
   - Search filtering (fullName/phone/KTP, contractNumber/motorModel, invoiceNumber, description)
   - Status/module filtering, date range filtering, dynamic sorting
   - Controllers: backward compatible — `page` param triggers paginated, otherwise array

2. **Dashboard Chart Data** (`DashboardService`):
   - `chartData.revenueByMonth`: groups paid invoices by month (last 6 months)
   - `chartData.contractsByStatus`: count per status

**Frontend:**

1. **Server-Side Pagination** (4 list pages):
   - `usePagination` hook: manages page, sort, debounced search (300ms), total/totalPages
   - `<Pagination>` component: `< Prev | 1 2 ... N | Next >`
   - `<SortableHeader>` component: clickable th with ArrowUp/Down/UpDown icons
   - API methods: `getCustomersPaginated`, `getContractsPaginated`, `getInvoicesPaginated`, `getAuditLogsPaginated`
   - All pages: replaced client-side filtering with server-side pagination + sorting

2. **Dashboard Charts** (Recharts):
   - `<RevenueChart>`: BarChart for revenue by month
   - `<StatusDistributionChart>`: PieChart (donut) for contracts by status
   - Dynamic imports with `ssr: false` for SSR safety

3. **Form Validation** (React Hook Form + Zod):
   - `schemas.ts`: loginSchema, customerSchema, contractSchema with validation rules
   - Login page: `useForm` + `zodResolver` + `register`
   - Customer form: `useForm` + `register` for inputs, inline `errors.field.message`
   - Contract form: `useForm` + `Controller` for Radix Select components

4. **Skeleton UI**:
   - `<Skeleton>` base component (`animate-pulse rounded-md bg-muted`)
   - `<DashboardSkeleton>`: stat cards + chart + activity placeholders
   - Table skeleton rows (inline) in all list pages during loading

5. **Empty State**:
   - `<EmptyState>` reusable: icon (with bg circle), title, description, optional CTA

6. **Command Palette** (`Ctrl+K`):
   - Global search: pages, customers (via API), contracts (via API)
   - Keyboard navigation: ArrowUp/Down, Enter, Escape
   - Search hint button in sidebar
   - `useKeyboardShortcut` reusable hook

### New Files

| File | Description |
|------|-------------|
| `backend/src/domain/interfaces/Pagination.ts` | PaginationParams, PaginatedResult types |
| `frontend/src/components/ui/pagination.tsx` | Pagination navigation component |
| `frontend/src/components/ui/skeleton.tsx` | Base skeleton component |
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

- `recharts` (frontend) - React chart library

### Phase 6 Status

- [x] Server-side pagination (4 list pages)
- [x] Table sorting (sortable headers)
- [x] Dashboard charts (Recharts - bar + pie)
- [x] Form validation (RHF + Zod - login, customer, contract)
- [x] Skeleton UI (dashboard + table rows)
- [x] Empty states (reusable component)
- [x] Command palette (Ctrl+K global search)
- [x] Keyboard shortcuts (useKeyboardShortcut hook)

### Tests

- 88 tests passing (4 suites, unchanged)
- Frontend build: clean, no TS errors

---

## Development Roadmap

> Prinsip: Fungsionalitas dulu → Polish & UX → Infrastruktur & Produksi.
> Setiap phase harus menghasilkan sistem yang lebih lengkap dan siap pakai.

### Phase 3: Core RTO Mechanics (Fundamental Business Logic) ✅ COMPLETED

Fokus: Memperbaiki model bisnis agar benar-benar mencerminkan sistem **Rent To Own** — bukan sewa harian lepas.

- [x] **Remodel kontrak sebagai RTO**
- [x] **Perpanjangan sewa (Top-Up / Extend)**
- [x] **Penarikan motor (Repossession)**
- [x] **Grace period & overdue logic**
- [x] **Ownership completion**

### Phase 4: Admin Controls & Contract Management ✅ COMPLETED

Fokus: Kontrol penuh untuk admin atas semua data dan operasi.

- [x] **Edit kontrak**
  - Endpoint `PUT /api/contracts/:id`
  - Admin bisa edit: catatan, grace period, ownership target
  - Ownership progress auto-recalculated when target changes
  - Frontend: edit dialog di contract detail page
- [x] **Cancel / terminate kontrak**
  - Endpoint `PATCH /api/contracts/:id/cancel`
  - Alasan pembatalan wajib diisi (reason field)
  - Reason appended to notes with [CANCELLED] prefix
  - Validation: cannot cancel completed/cancelled/repossessed contracts
  - Catat di audit log
- [x] **Edit & delete customer** improvements
  - Validasi: tidak bisa hapus customer yang masih punya kontrak aktif/overdue
  - CustomerService now accepts optional IContractRepository
- [x] **Edit invoice**
  - Admin bisa menandai invoice sebagai VOID (`PATCH /api/invoices/:id/void`)
  - Koreksi pembayaran manual (`PATCH /api/invoices/:id/mark-paid`)
  - Mark-paid applies extension to contract same as simulatePayment
  - PaymentStatus.VOID added to enums
- [x] **Konfirmasi dialog** untuk semua operasi destructive
  - Repossess, cancel, void invoice, mark-paid semua pakai dialog konfirmasi
  - Cancel requires reason input
- [x] **Delete kontrak** (soft delete)
  - Endpoint `DELETE /api/contracts/:id`
  - `isDeleted` + `deletedAt` fields on Contract entity
  - Cannot delete active/overdue contracts
  - `getAll()` filters deleted by default
- [x] **Bulk operations**
  - `POST /api/invoices/bulk-pay` - bulk mark invoices as paid
  - Returns `{ success: string[], failed: Array<{ id, error }> }`

### Phase 5: Financial Features & Reporting ✅ COMPLETED

Fokus: Tracking keuangan yang akurat dan laporan yang berguna.

- [x] **Payment history timeline**
  - Vertical timeline on contract detail page
  - Shows all paid invoices chronologically with type, date, amount
- [x] **Denda keterlambatan (late fee)**
  - `lateFee` field on Invoice entity
  - `late_fee_per_day` configurable setting (default Rp 10,000)
  - Revenue calculations include lateFee
  - Auto-calculation logic deferred
- [x] **Enhanced reports**
  - Filters: date range, contract status, motor model
  - Contracts by status breakdown with visual bars
  - Revenue by motor model, revenue by month (6 months)
  - Top 10 customers by total paid
  - Overdue count, average ownership progress
- [x] **PDF invoice generation**
  - PdfService using pdfkit library
  - Full A4 invoice with header, customer info, line items, totals, QR code
  - `GET /api/invoices/:id/pdf` endpoint
  - Download buttons on invoices page and contract detail page
- [x] **Export improvements**
  - XLSV (Excel-compatible TSV) export with multiple sections
  - All exports support report filters
  - `GET /api/reports/export/xlsv` endpoint

### Phase 6: UX Polish & Frontend Improvements ✅ COMPLETED

Fokus: Pengalaman pengguna yang lebih baik dan UI yang lebih lengkap.

- [x] **Enhanced dashboard with charts**
  - Revenue bar chart (last 6 months) using Recharts
  - Pie chart distribusi status kontrak (donut chart)
  - Dynamic import (SSR-safe) for chart components
- [x] **Server-side pagination on all list views**
  - `PaginationParams` + `PaginatedResult<T>` interfaces
  - Backend: 4 repos, 4 services, 4 controllers updated
  - Frontend: `usePagination` hook with debounced search
  - `<Pagination>` component with page navigation
  - Backward compatible: no `page` param = array response
- [x] **Table sorting**
  - `<SortableHeader>` component with sort icons
  - Sortable columns on all 4 list pages
  - Server-side sorting by any field
- [x] **Form validation with React Hook Form + Zod**
  - `schemas.ts`: loginSchema, customerSchema, contractSchema
  - Login, customer create/edit, contract create forms converted
  - Inline error messages per field
  - Controller pattern for Radix Select components
- [x] **Loading states & skeleton UI**
  - `<Skeleton>` base component
  - `<DashboardSkeleton>` for dashboard page
  - Inline table skeleton rows on all list pages
- [x] **Empty states**
  - `<EmptyState>` reusable component with icon, title, description, CTA
  - Contextual messages (filtered vs no data)
- [x] **Keyboard shortcuts & Command Palette**
  - `Ctrl+K` / `Cmd+K` opens global command palette
  - Search pages, customers, contracts with keyboard navigation
  - `useKeyboardShortcut` reusable hook
  - Search hint button in sidebar

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
