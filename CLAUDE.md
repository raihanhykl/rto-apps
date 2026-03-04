# WEDISON RTO Management System - Technical Documentation

> Single source of truth for project progress and architecture decisions.

## Project Overview

- **Company**: WEDISON (Motor Listrik / Electric Motorcycle)
- **System**: Internal RTO (Rent To Own) Management
- **Users**: Admin only (no customer login)
- **Motor Models**:
  - Athena Regular Battery (58K/day, DP Rp 530.000)
  - Athena Extended Battery (63K/day, DP Rp 580.000)
  - Victory Regular Battery (58K/day, DP Rp 530.000)
  - Victory Extended Battery (63K/day, DP Rp 580.000)
  - EdPower (83K/day, DP Rp 780.000)
- **Ownership Target**: 1.278 hari
- **Billing Model**: Auto-billing harian dengan rollover
- **Payment Gateway**: DOKU
- **Manual Payment**: 1–7 hari ke depan (opsi tambahan)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, ShadCN UI |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Backend | Express.js, TypeScript, Clean Architecture |
| Scheduler | node-cron (daily billing at 00:01 WIB) |
| Data | PostgreSQL + Prisma (production), In-Memory (dev/test) |
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
| PATCH | /api/invoices/:id/revert | Revert invoice status to PENDING |
| POST | /api/invoices/bulk-pay | Bulk mark invoices as paid |
| GET | /api/invoices/:id/pdf | Download invoice as PDF |
| PUT | /api/contracts/:id | Edit contract |
| PATCH | /api/contracts/:id/cancel | Cancel contract |
| DELETE | /api/contracts/:id | Soft delete contract |
| POST | /api/contracts/:id/pay-billing | Bayar tagihan (1-7 hari) |
| PATCH | /api/contracts/:id/repossess | Repossess motor |
| PATCH | /api/contracts/:id/receive-unit | Mark unit received |
| GET | /api/contracts/overdue-warnings | Get overdue warnings |
| GET/POST | /api/billings | List/Generate billings |
| GET | /api/billings/:id | Get billing detail |
| POST | /api/billings/:id/pay | Pay billing → generate invoice |
| POST | /api/billings/contract/:contractId/manual | Create manual billing (1-7 days) |
| PATCH | /api/billings/:id/cancel | Cancel billing (revert if merged) |
| POST | /api/webhooks/doku | DOKU payment webhook (public) |
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

## 2026-03-03 - Phase 6.5: RTO Business Model Overhaul (PLANNED)

### Context

Perubahan signifikan pada model bisnis RTO sebelum masuk Phase 7. Sistem berubah dari model extension sederhana menjadi sistem billing harian otomatis dengan Down Payment, payment gateway DOKU, dan WhatsApp reminder.

### Daftar Perubahan

#### PERUBAHAN 1 — Terminologi
- Ganti semua label "Extend Sewa" / "Perpanjang Sewa" → **"Bayar Tagihan"**
- Pilihan rentang hari tetap: 1–7 hari (sebagai opsi pembayaran manual)

#### PERUBAHAN 2 — Down Payment (DP)
Pengajuan RTO pertama wajib bayar DP:

| Motor + Battery | DP Amount |
|----------------|-----------|
| Athena / Victory (Regular Battery) | Rp 530.000 |
| Athena / Victory (Extended Battery) | Rp 580.000 |
| EdPower | Rp 780.000 |

Skema pembayaran DP:
- **a) Lunas sekaligus** saat pengajuan
- **b) Dicicil 2x**: cicilan 1 saat pengajuan, cicilan 2 setelah unit diterima

Tagihan harian mulai berjalan **H+1 setelah user menerima unit motor** (H penerimaan = bebas tagihan).

#### PERUBAHAN 3 — Cicilan DP
- Admin dapat mengkonfigurasi nominal cicilan DP di settings
- Default: DP dibagi 2 merata (contoh: Rp 580.000 → 2x Rp 290.000)

#### PERUBAHAN 4 — Lifecycle Billing & Invoice
Dua status berbeda untuk tagihan harian:
- **BILLING**: Status awal saat tagihan diterbitkan (belum dibayar)
- **INVOICE**: Status setelah billing berhasil dibayar (generate invoice otomatis)

Aturan:
- Billing expired/dibatalkan → soft delete, history tetap tersimpan
- Billing TIDAK langsung menjadi invoice; harus melalui proses pembayaran

#### PERUBAHAN 5 — Target Kepemilikan
- Total hari target kepemilikan penuh = **1.278 hari** (sebelumnya 1.825 hari)

#### PERUBAHAN 6 — Fasilitas Libur Bayar
Ketentuan per kontrak:
- HANYA berlaku di hari **Minggu**
- Minimal: 2 hari per bulan
- Maksimal: 4 hari per bulan
- Default: 2 hari per bulan
- Jumlah ditentukan oleh admin per kontrak

#### PERUBAHAN 7 — Mekanisme Billing Otomatis & Rollover
- Sistem generate billing otomatis **1x sehari**
- Rollover jika user tidak bayar:
  - Tgl 3 → billing Rp 55.000 diterbitkan
  - User tidak bayar → Tgl 4 → billing baru Rp 110.000 (55.000 × 2 hari)
  - Billing Tgl 3 expired, tidak bisa digunakan lagi
  - User WAJIB bayar billing terbaru yang sudah akumulasi
- Fitur manual payment (1–7 hari ke depan) tetap tersedia sebagai opsi tambahan

#### PERUBAHAN 8 — Payment Gateway: DOKU
- Semua transaksi (tagihan harian + DP) via **DOKU Payment Gateway**
- Billing baru → hit DOKU API → generate payment link
- Simpan response DOKU (payment URL, reference ID) di database
- Webhook handler untuk konfirmasi pembayaran otomatis

#### PERUBAHAN 9 — Reminder Otomatis via WhatsApp
- Kirim reminder setiap hari: **pagi** dan **sore**
- Konten: nominal tagihan, link pembayaran (DOKU), panduan pembayaran

### Technical Impact

**New Entities:**
- `Billing` — Daily billing lifecycle (separate from Invoice)

**Modified Entities:**
- `Contract` — Add: batteryType, unitReceivedDate, dpAmount, dpScheme, dpPaidAmount, holidayDaysPerMonth, billingStartDate
- `Invoice` — Add: type (DP/DP_INSTALLMENT/DAILY_BILLING/MANUAL_PAYMENT), dokuPaymentUrl, dokuReferenceId, billingPeriodStart, billingPeriodEnd

**New Enums:**
- `BatteryType`: REGULAR, EXTENDED
- `InvoiceType`: DP, DP_INSTALLMENT, DAILY_BILLING, MANUAL_PAYMENT
- `BillingStatus`: ACTIVE, PAID, EXPIRED, CANCELLED

**New Services:**
- `BillingService` — Auto-billing, rollover, billing→invoice conversion, Libur Bayar
- `DokuService` — DOKU API integration (payment link, webhook)
- `WhatsAppService` — WhatsApp API integration
- `ReminderService` — Scheduled reminders (morning + afternoon)

**New Infrastructure:**
- `scheduler.ts` — Cron jobs (daily billing, reminders)
- `WebhookController` — DOKU webhook handler (public endpoint)

**Updated Constants:**
- `OWNERSHIP_TARGET_DAYS`: 1825 → 1278
- `DP_AMOUNTS`: New constant per motor+battery
- `MOTOR_DAILY_RATES`: Now keyed by `MOTOR_BATTERY` (Athena/Victory Regular 58K, Extended 63K, EdPower 83K)

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/contracts/:id/pay-billing | Bayar tagihan manual (1-7 hari) |
| PATCH | /api/contracts/:id/receive-unit | Mark unit motor diterima |
| GET/POST | /api/billings | List/Generate billings |
| GET | /api/billings/:id | Get billing detail |
| POST | /api/billings/:id/pay | Pay billing → generate invoice |
| POST | /api/billings/contract/:contractId/manual | Create manual billing (1-7 days) |
| PATCH | /api/billings/:id/cancel | Cancel billing (revert if merged) |
| POST | /api/webhooks/doku | DOKU payment webhook (public) |

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

### Phase 6.5: RTO Business Model Overhaul (Micro-Phases)

> Fokus: Transformasi model bisnis RTO — DP, billing otomatis, DOKU, WhatsApp reminder.
> Phase 7 (Security) ditunda sampai semua micro-phase ini selesai dan stabil.

#### MP-6A: Domain Model & Enum Overhaul (Backend) — Kompleksitas: M ✅ COMPLETED

- [x] Update `Contract` entity: batteryType, unitReceivedDate, dpAmount, dpScheme, dpPaidAmount, holidayDaysPerMonth, billingStartDate
- [x] Update `Invoice` entity: type, dokuPaymentUrl, dokuReferenceId, billingPeriodStart, billingPeriodEnd
- [x] Create `Billing` entity baru (daily billing lifecycle)
- [x] Add enums: BatteryType, InvoiceType, BillingStatus, DPScheme
- [x] Update constants: OWNERSHIP_TARGET_DAYS=1278, DP_AMOUNTS, MOTOR_DAILY_RATES (motor+battery keys)
- [x] Create IBillingRepository interface + InMemoryBillingRepository
- [x] Update frontend types (Contract, Invoice, Billing, enums, constants)

**Files:** Contract.ts, Invoice.ts, Billing.ts (new), enums/index.ts, interfaces/, InMemoryBillingRepository.ts (new), frontend types/index.ts
**Dependencies:** Tidak ada (foundation layer)

#### MP-6B: DP & Contract Creation Flow (Backend) — Kompleksitas: M ✅ COMPLETED

- [x] Update CreateContractDto: remove durationDays, add batteryType + dpScheme
- [x] Rewrite ContractService.create() untuk DP flow (contract starts durationDays=0, totalAmount=0)
- [x] Generate DP invoice: FULL=1 invoice (type=DP), INSTALLMENT=2 invoices (type=DP_INSTALLMENT, ceil/floor split)
- [x] Add ContractService.receiveUnit(): validate DP paid, set unitReceivedDate + billingStartDate (H+1)
- [x] Add ContractController.receiveUnit handler + PATCH /api/contracts/:id/receive-unit route
- [x] Update SettingService: ownership_target_days default 1825→1278
- [x] Update seed data with DP invoices, battery types, realistic DP scenarios
- [x] Update ContractService tests: 93 tests passing (up from 88), 7 new receiveUnit tests

**Files:** dtos/index.ts, ContractService.ts, ContractController.ts, routes/index.ts, SettingService.ts, seed.ts, ContractService.test.ts
**Dependencies:** MP-6A

#### MP-6C: Billing Lifecycle & Rollover (Backend) — Kompleksitas: L ✅ COMPLETED

- [x] Create BillingService: generateDailyBilling(), rolloverExpiredBillings(), payBilling()
- [x] Billing → Invoice conversion on payment (payBilling creates DAILY_BILLING invoice)
- [x] Libur Bayar logic (Minggu auto-holiday + configurable holidays per month spread evenly)
- [x] Holiday billings: zero amount, auto-PAID, credits 1 free day to ownership
- [x] Rollover: expired billing → new billing with accumulated amount + days
- [x] Create scheduler.ts: node-cron daily task runner (00:01 WIB)
- [x] Scheduler runs: rolloverExpiredBillings → generateDailyBilling → checkAndUpdateOverdueContracts
- [x] InMemoryBillingRepository registered in repos index
- [x] BillingController with routes: GET /billings/contract/:id, GET /billings/contract/:id/active, POST /billings/:id/pay
- [x] Registered scheduler + BillingService + BillingController in index.ts
- [x] BillingService tests: 18 new tests (111 total, 5 suites)

**Files:** BillingService.ts (new), BillingController.ts (new), scheduler.ts (new), InMemoryBillingRepository.ts, index.ts, routes/index.ts, services/index.ts, repositories/index.ts
**Dependencies:** MP-6A, MP-6B

#### MP-6D: DOKU Payment Gateway (Backend) — Kompleksitas: L

- [ ] Create DokuService: createPaymentLink(), handleWebhook(), checkPaymentStatus()
- [ ] Integrate DOKU di BillingService (auto-generate payment link)
- [ ] Integrate DOKU di InvoiceService (DP payment)
- [ ] Create WebhookController + public webhook route
- [ ] DOKU config (API credentials, environment)

**Files:** DokuService.ts (new), WebhookController.ts (new), BillingService.ts, InvoiceService.ts, routes/index.ts, config/
**Dependencies:** MP-6C

#### MP-6E: WhatsApp Reminder (Backend) — Kompleksitas: M

- [ ] Create WhatsAppService: sendReminder(), buildMessage()
- [ ] Create ReminderService: scheduleMorningReminder(), scheduleAfternoonReminder()
- [ ] Add reminder cron jobs ke scheduler.ts
- [ ] WhatsApp API config

**Files:** WhatsAppService.ts (new), ReminderService.ts (new), scheduler.ts, config/
**Dependencies:** MP-6D (butuh payment link dari DOKU)

#### MP-6F: Frontend — Terminologi & Contract Form (Frontend) — Kompleksitas: S ✅ COMPLETED

- [x] Rename semua "Perpanjang Sewa" → "Bayar Tagihan" across all frontend pages
- [x] Rename "Perpanjangan" → "Tagihan Harian" in receipt/void/mark-paid dialogs
- [x] Add battery type selector (REGULAR/EXTENDED) di contract creation form
- [x] Add DP scheme selector (Lunas/Cicilan 2x) di contract creation form
- [x] DP cost preview with installment breakdown in contract form
- [x] Update contractSchema: removed durationDays, added batteryType + dpScheme
- [x] Update API client: added receiveUnit() method
- [x] Frontend TypeScript compiles clean

**Files:** contracts/[id]/page.tsx, contracts/page.tsx, invoices/page.tsx, schemas.ts, api.ts
**Dependencies:** MP-6B

#### MP-6G: Frontend — Billing & DP UI — Kompleksitas: M ✅ COMPLETED

- [x] API client updated: getBillingsByContract, getActiveBillingByContract, payBilling
- [x] DP section di contract detail (status DP, scheme, amount, paid amount, DP invoices list)
- [x] Billing section di contract detail (active billing with pay button, billing history)
- [x] Libur Bayar info display (Setiap Minggu + N hari/bulan)
- [x] Unit delivery display + "Terima Unit" button with confirmation dialog
- [x] Battery type display in contract detail ("Tipe Baterai" field)
- [x] DP status column di contract list (Lunas/Pending badge)
- [x] ~~Create BillingCard component~~ (integrated directly into contract detail page)
- [x] Frontend TypeScript compiles clean

**Files:** contracts/[id]/page.tsx, contracts/page.tsx, api.ts
**Dependencies:** MP-6C, MP-6F

#### MP-6H: Frontend — Payment Gateway & Reminder UI — Kompleksitas: S

- [ ] DOKU payment link display di billing/invoice
- [ ] Payment link column di invoices page
- [ ] Reminder settings di settings page
- [ ] DOKU config display di settings page

**Files:** contracts/[id]/page.tsx, invoices/page.tsx, settings/page.tsx
**Dependencies:** MP-6D, MP-6G

#### MP-6I: Seed Data & Tests Update — Kompleksitas: M

- [ ] Rewrite seed.ts untuk model DP + billing
- [ ] Update ContractService.test.ts untuk DP flow
- [ ] Update InvoiceService.test.ts untuk billing→invoice flow
- [ ] Create BillingService.test.ts (new test suite)
- [ ] Create DokuService.test.ts (mocked, new test suite)

**Files:** seed.ts, ContractService.test.ts, InvoiceService.test.ts, BillingService.test.ts (new), DokuService.test.ts (new)
**Dependencies:** Semua backend micro-phases (MP-6A s/d MP-6E)

#### Execution Order

```
MP-6A → MP-6B → MP-6F → MP-6C → MP-6G → MP-6D → MP-6H → MP-6E → MP-6I
```

#### Dependency Graph

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

Update data model customer dan kontrak agar sesuai dengan kebutuhan operasional RTO yang sebenarnya. Menambahkan field untuk data pribadi lengkap (TTL, jenis kelamin, aplikasi ojol, penjamin, pasangan, dokumen foto) pada Customer, dan detail unit (warna, tahun, VIN, nomor mesin) pada Contract.

### What was changed

**Backend - Domain:**

1. **Customer Entity** - Added fields:
   - `birthDate: string | null` (TTL)
   - `gender: Gender | null` (Laki-laki/Perempuan)
   - `rideHailingApps: string[]` (Grab, Gojek, Maxim, Indrive, Shopee, dll)
   - `ktpPhoto: string | null` (foto KTP)
   - `simPhoto: string | null` (foto SIM)
   - `kkPhoto: string | null` (foto KK)
   - `guarantorName: string` (Nama Penjamin)
   - `guarantorPhone: string` (Telepon Penjamin)
   - `guarantorKtpPhoto: string | null` (foto KTP Penjamin)
   - `spouseName: string` (Nama Pasangan, opsional)
   - `spouseKtpPhoto: string | null` (foto KTP Pasangan, opsional)

2. **Contract Entity** - Added fields:
   - `color: string` (Warna motor)
   - `year: number | null` (Tahun motor)
   - `vinNumber: string` (VIN number)
   - `engineNumber: string` (Nomor mesin)

3. **New Enum**: `Gender` (MALE, FEMALE)

**Backend - Application:**

1. **CreateCustomerDto** - Added all new customer fields with optional defaults
2. **UpdateCustomerDto** - Inherits from CreateCustomerDto.partial()
3. **CreateContractDto** - Added: color, year, vinNumber, engineNumber (all optional)
4. **UpdateContractDto** - Added: color, year, vinNumber, engineNumber (all optional)
5. **CustomerService.create()** - Maps all new fields from DTO to entity
6. **ContractService.create()** - Maps unit detail fields
7. **ContractService.editContract()** - Handles updating unit detail fields

**Backend - Infrastructure:**

1. **Seed data** - Updated with realistic customer data:
   - Birth dates, genders, ride-hailing apps, guarantor names/phones
   - Contract unit details: colors, year 2025, VIN numbers, engine numbers

**Frontend:**

1. **Types** - Added Gender enum, all new Customer/Contract fields
2. **Customer Form** (`customers/page.tsx`):
   - Widened dialog (max-w-2xl) with scrollable content
   - Sections: Data Pribadi, Aplikasi Ojol (toggle buttons), Penjamin, Pasangan
   - Birth date (date input), gender (select), ride-hailing apps (chip toggles)
   - Guarantor name/phone, spouse name fields
   - Note about photo upload (deferred to Phase 8)
3. **Customer List** - Added Aplikasi (badge chips) and Penjamin columns
4. **Customer Detail** (`customers/[id]/page.tsx`):
   - Shows: birth date, gender, apps badges, guarantor section, spouse section
   - New icons: Calendar, Users, Heart, Car
5. **Contract Form** (`contracts/page.tsx`):
   - "Detail Unit" section: warna, tahun, VIN number, nomor mesin
   - Year converted from string to number on submit
6. **Contract Detail** (`contracts/[id]/page.tsx`):
   - "Detail Unit" sub-section showing color, year, VIN, engine number
   - Edit dialog expanded with unit detail fields
7. **API Client** - Updated `editContract()` signature with new fields
8. **Schemas** - Updated customerSchema and contractSchema with new fields

### Modified Files

**Backend:**
- `packages/backend/src/domain/entities/Customer.ts`
- `packages/backend/src/domain/entities/Contract.ts`
- `packages/backend/src/domain/enums/index.ts` (Gender enum)
- `packages/backend/src/application/dtos/index.ts`
- `packages/backend/src/application/services/CustomerService.ts`
- `packages/backend/src/application/services/ContractService.ts`
- `packages/backend/src/infrastructure/seed.ts`
- `packages/backend/src/__tests__/CustomerService.test.ts`
- `packages/backend/src/__tests__/ContractService.test.ts`
- `packages/backend/src/__tests__/InvoiceService.test.ts`
- `packages/backend/src/__tests__/BillingService.test.ts`

**Frontend:**
- `packages/frontend/src/types/index.ts`
- `packages/frontend/src/lib/schemas.ts`
- `packages/frontend/src/lib/api.ts`
- `packages/frontend/src/app/(dashboard)/customers/page.tsx`
- `packages/frontend/src/app/(dashboard)/customers/[id]/page.tsx`
- `packages/frontend/src/app/(dashboard)/contracts/page.tsx`
- `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx`

### Tests

- 111 tests passing (5 suites, unchanged count)
- All existing tests updated with new required entity fields
- Frontend TypeScript compiles clean
- Backend TypeScript compiles clean

### Notes

- Photo upload fields (ktpPhoto, simPhoto, kkPhoto, guarantorKtpPhoto, spouseKtpPhoto) are stored as `string | null` (URL/path). Actual file upload mechanism deferred to Phase 8 (File Upload).
- Customer form shows a note: "Upload foto dokumen akan tersedia setelah fitur upload diimplementasi."

---

## 2026-03-03 - Bug Fixes, UX Improvements & Admin Controls

### Context

Comprehensive round of bug fixes, UX improvements, and admin control features based on operational feedback.

### What was changed

**Bug Fixes (Backend):**

1. **DP status not updating after payment** - `InvoiceService.applyPaymentToContract()` rewritten to handle DP/DP_INSTALLMENT invoice types. Now updates `dpPaidAmount` and `dpFullyPaid` on contract when DP invoices are paid.

2. **Late fee always applied** - `ContractService.extend()` late fee calculation changed from `if (existing.endDate < now)` to `if (existing.status === ContractStatus.OVERDUE && existing.billingStartDate)`. Only applies late fee when contract is genuinely overdue and billing has started.

**DP Validation & BAST (Backend + Frontend):**

1. **DP validation on receive unit** - Backend `receiveUnit()` now checks `dpFullyPaid` flag first, then verifies against individual invoice statuses. Frontend shows warning banner when DP not fully paid.

2. **BAST (Berita Acara Serah Terima)** - Added `bastPhoto: string | null` and `bastNotes: string` to Contract entity. `receiveUnit()` now requires `bastPhoto` (mandatory) and accepts `bastNotes` (optional). Frontend dialog updated with photo URL input and notes textarea.

**Invoice Revert Feature (Backend + Frontend):**

1. **Revert invoice status** - New `PATCH /api/invoices/:id/revert` endpoint. Allows admin to revert PAID or VOID invoices back to PENDING. When reverting from PAID, automatically undoes contract changes (DP tracking, extension days, ownership progress).

2. **Frontend Revert button** - Added "Revert" button on PAID and VOID invoices in both contract detail page and invoices list page. Orange-themed confirmation dialog warns about reverting contract changes.

**Terminology Update (Frontend):**

- All user-visible "Invoice" text changed to "Tagihan" across:
  - Invoices page: heading, subtitle, search placeholder, empty states, counters
  - Contract detail page: section headers, dialog titles, toast messages
  - Customer detail page: section header, table header, empty state
  - Sidebar navigation: "Invoices" → "Tagihan"
  - Command palette: search result title and subtitle
  - All confirmation dialogs: "Void Invoice" → "Void Tagihan", etc.

**Payment Status Summary (Frontend):**

- New prominent payment status card at top of contract detail page
- Color-coded based on state: DP pending (yellow), unit not received (blue), overdue (red), active billing (blue), all clear (green), completed (green), repossessed (red), cancelled (gray)
- Shows contextual message and quick stats (progress %, days paid, total paid)
- Replaces need to scroll down to find payment information

**Edit Customer (Frontend):**

- Added edit button on customer detail page header
- Full edit dialog with sections: Data Pribadi, Aplikasi Ojol (toggle buttons), Penjamin, Pasangan, Catatan
- Uses existing `PUT /api/customers/:id` endpoint

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| PATCH | /api/invoices/:id/revert | Revert invoice status to PENDING |

### Modified Files

**Backend:**
- `packages/backend/src/domain/entities/Contract.ts` (bastPhoto, bastNotes)
- `packages/backend/src/application/services/ContractService.ts` (late fee fix, BAST in create/receiveUnit)
- `packages/backend/src/application/services/InvoiceService.ts` (DP fix, revertInvoiceStatus)
- `packages/backend/src/presentation/controllers/ContractController.ts` (BAST params)
- `packages/backend/src/presentation/controllers/InvoiceController.ts` (revertStatus handler)
- `packages/backend/src/presentation/routes/index.ts` (revert route)
- `packages/backend/src/infrastructure/seed.ts` (BAST fields)
- `packages/backend/src/__tests__/ContractService.test.ts` (BAST tests, receiveUnit params)
- `packages/backend/src/__tests__/InvoiceService.test.ts` (BAST fields)
- `packages/backend/src/__tests__/BillingService.test.ts` (BAST fields)

**Frontend:**
- `packages/frontend/src/types/index.ts` (bastPhoto, bastNotes on Contract)
- `packages/frontend/src/lib/api.ts` (receiveUnit params, revertInvoiceStatus)
- `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx` (payment status, BAST dialog, revert, terminology)
- `packages/frontend/src/app/(dashboard)/invoices/page.tsx` (revert button/dialog, terminology)
- `packages/frontend/src/app/(dashboard)/customers/[id]/page.tsx` (edit dialog, terminology)
- `packages/frontend/src/components/Sidebar.tsx` (Tagihan label)
- `packages/frontend/src/components/CommandPalette.tsx` (Tagihan label)

### Tests

- 112 tests passing (5 suites)
- New test: BAST photo validation on receiveUnit
- Updated receiveUnit tests with bastPhoto parameter
- Frontend and backend TypeScript compile clean

---

## 2026-03-03 - Billing Accumulation, Calendar & State Refresh Fixes

### Context

Fix 3 bugs terkait billing overdue, kalender pembayaran, dan frontend state refresh.

### What was changed

**Bug 1: Billing Overdue Tidak Terakumulasi**

- **Problem**: Kontrak overdue dengan beberapa hari tunggakan hanya menampilkan billing 1 hari (58K), padahal seharusnya billing menumpuk berdasarkan jumlah hari yang belum dibayar.
- **Root cause**: `generateDailyBilling()` hanya memproses kontrak ACTIVE (tidak OVERDUE), dan selalu membuat billing 1 hari saja. Juga ada double-rollover bug di mana `rolloverExpiredBillings()` dan `generateDailyBilling()` sama-sama melakukan rollover.
- **Fix**:
  - `generateDailyBilling()` sekarang memproses kontrak ACTIVE dan OVERDUE
  - Menghitung accumulated unpaid working days dari `endDate + 1` sampai `tomorrow`
  - Menghapus rollover logic dari `generateDailyBilling()` — sekarang hanya `rolloverExpiredBillings()` yang menangani rollover
  - Billing baru dibuat dengan amount = unpaidWorkingDays × dailyRate

**Bug 2: Kalender Pembayaran Highlight Tanggal Salah**

- **Problem**: Ketika ada billing aktif hari ini (misal tgl 3), yang di-highlight kuning di kalender justru tgl 4 (besok), bukan tgl 3.
- **Root cause**: Billing model prepaid — billing diterbitkan hari ini untuk usage besok. `getCalendarData()` hanya menandai range `periodStart..periodEnd` (besok) sebagai pending, tidak termasuk hari ini.
- **Fix**: Menambahkan pengecekan `date.getTime() === today.getTime()` di `getCalendarData()` sehingga hari ini juga ditandai pending ketika ada billing aktif.

**Bug 3: Frontend State Tidak Update Setelah Perubahan**

- **Problem**: PaymentCalendar component tidak refresh setelah mutasi (bayar billing, terima unit, dll) tanpa reload halaman.
- **Root cause**: PaymentCalendar fetch data independen via `useEffect` pada `[contractId, year, month]`, tidak terpicu oleh parent `loadData()`.
- **Fix**:
  - Menambahkan `refreshKey` prop pada PaymentCalendar (increment counter triggers re-fetch)
  - Menambahkan `calendarKey` state + `refreshAll()` helper di contract detail page
  - Mengganti semua `await loadData()` di 9 mutation handler dengan `await refreshAll()`

### Modified Files

**Backend:**
- `packages/backend/src/application/services/BillingService.ts` (generateDailyBilling rewrite, getCalendarData fix)
- `packages/backend/src/__tests__/BillingService.test.ts` (updated tests, 2 new test cases)

**Frontend:**
- `packages/frontend/src/components/PaymentCalendar.tsx` (refreshKey prop)
- `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx` (calendarKey state, refreshAll helper)

### Tests

- 114 tests passing (5 suites, up from 112)
- 2 new tests: accumulated billing for overdue contracts, billing generation for OVERDUE contracts
- Updated existing billing tests to match new accumulated billing behavior

---

## 2026-03-03 - Payment Calendar Color Logic Fix

### Context

Perbaikan logika warna kalender pembayaran agar tanggal-tanggal yang sudah lewat dalam billing aktif (dari rollover/akumulasi) ditampilkan sebagai merah (overdue), bukan kuning (pending).

### Aturan Warna Kalender

| Warna | Status | Keterangan |
|-------|--------|------------|
| Hijau | `paid` | Sudah dibayar |
| Kuning | `pending` | Tagihan sudah keluar, belum dibayar (hari ini/mendatang) |
| Merah | `overdue` | Tagihan lewat dan tidak dibayarkan (tanggal yang sudah terlewat) |
| Biru | `holiday` | Libur bayar (Minggu) |
| Abu-abu | `not_issued` | Tagihan belum keluar |

### What was changed

**Backend (`BillingService.getCalendarData()`):**

- Tanggal dalam periode billing aktif sekarang dibedakan berdasarkan waktu:
  - `date < today` → `overdue` (merah) — hari-hari akumulasi/rollover yang belum dibayar
  - `date >= today` → `pending` (kuning) — tagihan hari ini yang menunggu pembayaran
  - `date.getDay() === 0` → `holiday` (biru) — Minggu tetap libur bayar meskipun dalam periode billing

### Modified Files

- `packages/backend/src/application/services/BillingService.ts` (getCalendarData logic)

### Tests

- 114 tests passing (5 suites, unchanged)

---

## 2026-03-03 - Calendar Coverage & Sunday-Aware EndDate Fix

### Context

Bug: Setelah membayar billing 3 hari (tgl 2, 3, 4), tanggal 4 muncul ABU-ABU (not_issued) padahal seharusnya HIJAU (paid). Root cause: perhitungan `coveredEndDate` dan `endDate` tidak memperhitungkan hari Minggu yang ada di antara range.

### What was changed

**1. `creditDayToContract()` — Sunday-aware endDate advancement:**

- Sebelumnya: `endDate += days` (calendar days langsung) → tidak skip Minggu
- Sesudah: Untuk working day credits, iterasi hari per hari dan skip hari Minggu
- Holiday credits tetap advance 1 calendar day langsung
- Contoh: endDate=Feb 28, 3 working days → skip Mar 1 (Sun) → endDate=Mar 4

**2. `getCalendarData()` — Gunakan endDate langsung:**

- Sebelumnya: `coveredEndDate = billingStart + totalDaysPaid - 1` (formula yang tidak akurat ketika ada Minggu di range)
- Sesudah: `coveredEndDate = contract.endDate` (langsung dari contract, yang sudah di-maintain oleh creditDayToContract)
- endDate selalu akurat karena di-update setiap kali ada pembayaran

**3. Seed data consistency:**

- `billingStartDate`: Diperbaiki dari `daysAgo(startDaysAgo - 1)` → `daysAgo(startDaysAgo - 2)` (H+1 setelah terima unit, bukan H+0)
- `endDate`: Diperbaiki dari `startDate + totalDaysPaid` (calendar days) → `advanceWorkingDays(startDate, totalDaysPaid)` (skip Sundays)
- Ditambahkan helper function `advanceWorkingDays()` di seed.ts

### Modified Files

- `packages/backend/src/application/services/BillingService.ts` (creditDayToContract, getCalendarData)
- `packages/backend/src/infrastructure/seed.ts` (billingStartDate, endDate, advanceWorkingDays helper)

### Tests

- 114 tests passing (5 suites, unchanged)

---

## 2026-03-03 - Libur Bayar Logic Fix & Manual Billing as Active Billing

### Context

Two bugs fixed:
1. **Libur Bayar**: Previously ALL Sundays were treated as holidays. Now only designated Sundays (based on `holidayDaysPerMonth` per contract, default 2) are Libur Bayar. Non-designated Sundays are regular working days requiring payment.
2. **Manual Billing**: "Bayar Tagihan" (1-7 days) now creates an ACTIVE Billing entity visible in "Tagihan Aktif", instead of a PENDING Invoice. Supports merge (void old + create combined) and cancel/revert behavior.

### What was changed

**Bug 1 — Libur Bayar (Backend):**

1. **`BillingService.getSundayHolidays(year, month, holidayDaysPerMonth)`** — New pure function. Finds all Sundays in a month, picks `holidayDaysPerMonth` evenly distributed using index-based algorithm.
2. **`BillingService.isLiburBayar(contract, date)`** — New method. Returns true only if date is a Sunday AND is a designated Libur Bayar for that contract.
3. **Replaced all `isHoliday()` calls** throughout BillingService:
   - `generateDailyBilling()` — accumulated billing and standard holiday check
   - `rolloverBilling()` — holiday rollover check
   - `creditDayToContract()` — endDate advancement now skips only Libur Bayar Sundays (not all Sundays)
   - `getCalendarData()` — calendar marks only Libur Bayar Sundays as blue (holiday)
4. **Removed**: `isHoliday()`, `shouldBeConfigurableHoliday()`, `getUsedHolidayDaysThisMonth()`
5. **seed.ts** — Updated `advanceWorkingDays()` to use `isLiburBayar` algorithm (matching `getSundayHolidays`)

**Bug 2 — Manual Billing (Backend):**

1. **`Billing.previousBillingId`** — New field on Billing entity for merge/cancel tracking
2. **`BillingService.createManualBilling(contractId, days, adminId)`**:
   - Creates ACTIVE billing for N days with amount = days * dailyRate
   - If active billing exists: cancels old, creates merged billing (old amount + new), sets previousBillingId
   - Period calculated from contract.endDate forward, skipping Libur Bayar Sundays
3. **`BillingService.cancelBilling(billingId, adminId)`**:
   - If billing has previousBillingId: reactivates previous billing (status → ACTIVE)
   - Cancels current billing (status → CANCELLED)
4. **BillingController** — Added `createManualBilling` and `cancelBilling` handlers
5. **Routes** — Added `POST /billings/contract/:contractId/manual` and `PATCH /billings/:id/cancel`

**Frontend:**

1. **API client** — Added `createManualBilling(contractId, days)` and `cancelBilling(billingId)`
2. **Contract detail page**:
   - `handleExtend()` now calls `api.createManualBilling()` instead of `api.extendContract()`
   - Added `handleCancelBilling()` handler
   - Active billing card shows "(Gabungan)" label when merged
   - Cancel button appears on merged billings (when `previousBillingId` exists)
3. **Frontend types** — Added `previousBillingId: string | null` to Billing interface

### New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/billings/contract/:contractId/manual | Create manual billing (1-7 days) |
| PATCH | /api/billings/:id/cancel | Cancel billing (revert if merged) |

### Modified Files

**Backend:**
- `packages/backend/src/domain/entities/Billing.ts` (previousBillingId)
- `packages/backend/src/application/services/BillingService.ts` (getSundayHolidays, isLiburBayar, createManualBilling, cancelBilling, replaced all isHoliday calls)
- `packages/backend/src/presentation/controllers/BillingController.ts` (createManualBilling, cancelBilling handlers)
- `packages/backend/src/presentation/routes/index.ts` (new routes)
- `packages/backend/src/infrastructure/seed.ts` (getSundayHolidays, isLiburBayar, advanceWorkingDays with Libur Bayar)
- `packages/backend/src/__tests__/BillingService.test.ts` (getSundayHolidays, isLiburBayar, createManualBilling, cancelBilling tests)

**Frontend:**
- `packages/frontend/src/types/index.ts` (previousBillingId)
- `packages/frontend/src/lib/api.ts` (createManualBilling, cancelBilling)
- `packages/frontend/src/app/(dashboard)/contracts/[id]/page.tsx` (handleExtend → createManualBilling, cancel button, merged label)

### Tests

- 129 tests passing (5 suites, up from 114)
- New tests: getSundayHolidays (3), isLiburBayar (3), createManualBilling (6), cancelBilling (5)
- Updated: holiday billing test uses fixed dates for designated Libur Bayar Sundays

---

### Phase 7: Security & Authentication (DITUNDA)

> Ditunda sampai Phase 6.5 selesai dan stabil.

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

### Phase 8: Database Migration & Production Readiness ✅ COMPLETED (Prisma)

Fokus: Migrasi ke database nyata dan persiapan production.

- [x] **PostgreSQL + Prisma migration**
- [x] **Environment configuration** (DATABASE_URL, CORS_ORIGIN, NODE_ENV)
- [ ] **File upload (KTP images)** — deferred
- [ ] **Error monitoring & logging** — deferred
- [ ] **Database backup strategy** — deferred

### Phase 9: Deployment

Fokus: CI/CD dan deployment.

- [x] **CI/CD pipeline (GitHub Actions)** — CI only (test + build on PR)
- [x] **Git branching strategy** — main/staging/develop/hotfix/chore
- [x] **Branch protection** — main + staging require PR + CI pass
- [ ] **Production deployment (VPS/Cloud)** — Railway (staging + production)
- [ ] **SSL/HTTPS setup**
- [ ] **Domain configuration**

---

## 2026-03-03 - Phase 8: PostgreSQL + Prisma Migration

### Context

Backend was using in-memory `Map`-based repositories. All data lost on restart — blocker for deployment. Migrated to PostgreSQL with Prisma ORM while preserving Clean Architecture (only infrastructure layer changes).

### What was built

**Prisma Schema** (`packages/backend/prisma/schema.prisma`):
- 7 models: User, Customer, Contract, Invoice, Billing, AuditLog, Setting
- 10 enums: MotorModel, BatteryType, ContractStatus, PaymentStatus, InvoiceType, BillingStatus, DPScheme, Gender, AuditAction, UserRole
- All relations (Customer→Contract→Invoice/Billing, Billing self-ref for merged billings)
- Indexes on all FKs, status fields, unique constraints
- Snake_case column/table names via `@map`/`@@map`
- `String[]` for rideHailingApps (native PG array), `Json` for metadata (JSONB)

**Prisma Client Singleton** (`packages/backend/src/infrastructure/prisma/client.ts`):
- Global singleton to prevent connection pool exhaustion during dev hot-reloads
- Conditional logging (verbose in dev, error-only in production)

**7 Prisma Repository Implementations**:
- `PrismaSettingRepository` — findAll, findByKey, upsert, delete
- `PrismaUserRepository` — findAll, findById, findByUsername, CRUD
- `PrismaAuditLogRepository` — findAllPaginated (search/module/date filter), findRecent, create, count
- `PrismaCustomerRepository` — findAllPaginated (search fullName/phone/email/ktp), search, soft-delete, count
- `PrismaContractRepository` — findAllPaginated (search/status/date filter), findByStatus, countByStatus
- `PrismaInvoiceRepository` — findAllPaginated (search/status/customerId filter), sumByStatus (aggregate)
- `PrismaBillingRepository` — findActiveByContractId, findByContractId, soft-delete, self-ref

**Each repo follows the pattern:**
- Implements same interface as InMemory counterpart
- `toEntity()` method for Prisma→domain type casting (enum compatibility)
- Parallel count+query for pagination
- `as any` casts for Prisma↔domain enum compatibility

**Conditional Repo Initialization** (`packages/backend/src/index.ts`):
- `DATABASE_URL` env var present → Prisma repos + PostgreSQL connection
- No `DATABASE_URL` → InMemory repos (local dev, tests)
- Graceful shutdown with `prisma.$disconnect()` on SIGTERM/SIGINT
- Seed dummy data only in InMemory mode

**Build Scripts** (`packages/backend/package.json`):
- `build`: `npx prisma generate && tsc`
- `postinstall`: `npx prisma generate || true`
- `db:push`: `npx prisma db push`
- `db:migrate:deploy`: `npx prisma migrate deploy`
- `db:seed`: `npx ts-node prisma/seed.ts`

**Prisma Seed Script** (`packages/backend/prisma/seed.ts`):
- Same data as `infrastructure/seed.ts` but uses PrismaClient directly
- Seeds: admin user, default settings, 8 customers, 9 contracts with DP/billing scenarios
- Idempotent: checks existing data before seeding

### New Files

| File | Description |
|------|-------------|
| `packages/backend/prisma/schema.prisma` | Prisma schema (7 models, 10 enums, relations, indexes) |
| `packages/backend/prisma/seed.ts` | Database seed script for production |
| `packages/backend/src/infrastructure/prisma/client.ts` | Prisma client singleton |
| `packages/backend/src/infrastructure/repositories/PrismaUserRepository.ts` | User repo |
| `packages/backend/src/infrastructure/repositories/PrismaCustomerRepository.ts` | Customer repo |
| `packages/backend/src/infrastructure/repositories/PrismaContractRepository.ts` | Contract repo |
| `packages/backend/src/infrastructure/repositories/PrismaInvoiceRepository.ts` | Invoice repo |
| `packages/backend/src/infrastructure/repositories/PrismaBillingRepository.ts` | Billing repo |
| `packages/backend/src/infrastructure/repositories/PrismaAuditLogRepository.ts` | AuditLog repo |
| `packages/backend/src/infrastructure/repositories/PrismaSettingRepository.ts` | Setting repo |

### Modified Files

| File | Change |
|------|--------|
| `packages/backend/package.json` | Added @prisma/client, prisma, build scripts |
| `packages/backend/src/index.ts` | Conditional Prisma/InMemory init, graceful shutdown |
| `packages/backend/src/infrastructure/config/index.ts` | Added databaseUrl |
| `packages/backend/src/infrastructure/repositories/index.ts` | Added Prisma repo exports |

### NOT Modified (Clean Architecture preserved)

- All domain entities, interfaces, enums — UNCHANGED
- All application services, DTOs — UNCHANGED
- All presentation controllers, routes — UNCHANGED
- All tests — UNCHANGED (continue using InMemory repos)
- All frontend code — UNCHANGED

### Deployment Guide

**Backend (Railway):**
1. Create Railway project + PostgreSQL addon (auto-provides `DATABASE_URL`)
2. Set env vars: `CORS_ORIGIN=https://your-app.vercel.app`, `NODE_ENV=production`
3. Build: `npm install && npm run build`
4. Start: `npx prisma db push && node dist/index.js`
5. Initial seed: `npx prisma db seed` (one-time)

**Frontend (Vercel):**
1. Root directory: `packages/frontend`
2. Set env var: `NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api`
3. No code changes needed

### Tests

- 129 tests passing (5 suites, unchanged)
- Backend TypeScript compiles clean
- Backend build (`prisma generate + tsc`) succeeds
- Dev server starts correctly in InMemory mode

---

## 2026-03-04 - Scheduler Upgrade: node-cron

### Context

Replaced `setInterval` (24-hour interval) with `node-cron` for the daily billing scheduler. `setInterval` was imprecise — billing would run 24 hours after server start instead of at a consistent time.

### What was changed

- **`packages/backend/src/infrastructure/scheduler.ts`**: Replaced `setInterval` with `node-cron` `schedule()`. Daily tasks now run at **00:01 WIB** (Asia/Jakarta timezone) consistently, regardless of when the server starts. Still runs immediately on startup for catch-up.

### Dependencies Added

- `node-cron` (backend) — Cron scheduler
- `@types/node-cron` (backend, devDependency) — TypeScript types

---

## 2026-03-04 - SDLC Git Branching Strategy & CI Setup

### Context

Setup proper SDLC Git workflow dengan branch protection, CI pipeline, dan environment separation untuk development/staging/production.

### Branching Strategy

```
develop/* ──PR──> staging ──PR──> main (production)
hotfix/*  ──PR──> main (+ backmerge ke staging)
chore/*   ──PR──> staging atau main
```

| Branch | Tujuan | Protection |
|--------|--------|------------|
| `main` | Production | PR required, CI must pass, no direct push |
| `staging` | Pre-production/QA | PR required, CI must pass, no direct push |
| `develop/*` | Feature development | No protection, per fitur |
| `hotfix/*` | Critical bug fixes | No protection, PR ke main |
| `chore/*` | Maintenance tasks | No protection, PR ke staging/main |

### Environment Separation

| | Development | Staging | Production |
|---|---|---|---|
| Branch | `develop/*` | `staging` | `main` |
| Backend | localhost:3001 | Railway (staging-backend) | Railway (production-backend) |
| Frontend | localhost:3000 | Vercel Preview | Vercel Production |
| Database | In-Memory / local PG | PostgreSQL (staging) | PostgreSQL (production) |
| `NODE_ENV` | `development` | `staging` | `production` |

### What was built

1. **`.github/workflows/ci.yml`** — GitHub Actions CI workflow:
   - Triggers on PR to `main` and `staging`
   - Steps: install, prisma generate, tsc check, jest tests, build backend, build frontend
   - Node 22, concurrency cancel-in-progress
   - Job name `ci` (referenced in branch protection status checks)

2. **`.env.example` files** — Environment variable documentation:
   - `packages/backend/.env.example`: PORT, NODE_ENV, CORS_ORIGIN, DATABASE_URL
   - `packages/frontend/.env.example`: NEXT_PUBLIC_API_URL

3. **`.gitignore` updates** — Broader `.env.*` pattern with `!.env.example` exception (root + frontend)

4. **Branch `staging`** — Created from main, pushed to GitHub

5. **Branch protection rules** — Configured via GitHub Settings:
   - `main`: Require PR, require `ci` status check, no bypass
   - `staging`: Same rules as `main`

### New Files

| File | Description |
|------|-------------|
| `.github/workflows/ci.yml` | GitHub Actions CI workflow |
| `packages/backend/.env.example` | Backend env vars documentation |
| `packages/frontend/.env.example` | Frontend env vars documentation |

### Modified Files

| File | Change |
|------|--------|
| `.gitignore` | `.env.*` + `!.env.example` (broader pattern) |
| `packages/frontend/.gitignore` | Added `!.env.example` exception |
