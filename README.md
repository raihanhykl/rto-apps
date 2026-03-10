# WEDISON RTO Management System

Internal Rent-To-Own (RTO) management system for WEDISON electric motorcycles. Admin-only system — no customer login.

## Motor Models & Rates

| Motor + Battery | Daily Rate | DP Amount |
|----------------|-----------|-----------|
| Athena Regular Battery | Rp 58.000/hari | Rp 530.000 |
| Athena Extended Battery | Rp 63.000/hari | Rp 580.000 |
| Victory Regular Battery | Rp 58.000/hari | Rp 530.000 |
| Victory Extended Battery | Rp 63.000/hari | Rp 580.000 |
| EdPower | Rp 83.000/hari | Rp 780.000 |

- **Ownership Target**: 1.278 hari kerja
- **Payment**: Tagihan harian otomatis (PMT-xxx) dengan rollover
- **Libur Bayar**: Minggu tertentu (2-4 per bulan, configurable per contract)
- **Payment Gateway**: DOKU (planned)
- **Manual Payment**: 1-7 hari ke depan

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, ShadCN UI |
| State | Zustand |
| Data Fetching | SWR (stale-while-revalidate) |
| Forms | React Hook Form + Zod |
| Backend | Express.js, TypeScript, Clean Architecture |
| Scheduler | node-cron (daily billing at 00:01 WIB) |
| Database | PostgreSQL + Prisma v6 (production), In-Memory (dev/test) |
| Testing | Jest + ts-jest |
| Monorepo | npm workspaces |
| CI/CD | GitHub Actions |
| Deployment | Railway (backend) + Vercel (frontend) |

## Architecture

```
Monorepo (npm workspaces)
├── packages/backend/     Express + TypeScript + Clean Architecture
│   ├── src/
│   │   ├── domain/           Entities, Enums, Repository Interfaces
│   │   ├── application/      Services (business logic), DTOs (Zod validation)
│   │   ├── infrastructure/   Repositories (InMemory + Prisma), Middleware, Config, Scheduler
│   │   ├── presentation/     Controllers, Routes
│   │   └── __tests__/        Jest unit tests
│   └── prisma/
│       ├── schema.prisma     Database schema (7 models, 10 enums)
│       ├── seed.ts           Production seed script
│       └── data/             Static seed data (customers.ts, contracts.ts)
│
├── packages/frontend/    Next.js 16 + Tailwind v4 + ShadCN
│   └── src/
│       ├── app/              Pages (App Router)
│       │   ├── (dashboard)/  Protected pages with sidebar layout
│       │   └── login/        Public login page
│       ├── components/       UI components, charts, skeletons
│       ├── hooks/            SWR hooks, pagination, keyboard shortcuts
│       ├── lib/              API client, utilities, schemas
│       ├── stores/           Zustand stores
│       └── types/            Shared TypeScript types
│
├── CLAUDE.md             AI instructions (for Claude)
├── README.md             Project documentation (this file)
├── docs/CHANGELOG.md     Development history per phase
└── railway.json          Railway deployment config
```

## Running the Project (127 tests, 4 suites)

### Prerequisites
- Node.js 22+
- npm 10+
- PostgreSQL (for production mode, optional for development)

### Development

```bash
# Install dependencies
npm install

# Start both frontend and backend (InMemory mode)
npm run dev

# Start backend only (port 3001)
npm run dev:backend

# Start frontend only (port 3000)
npm run dev:frontend
```

### With PostgreSQL

```bash
# Set DATABASE_URL in packages/backend/.env
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/wedison" > packages/backend/.env

# Push schema to database
cd packages/backend && npx prisma db push

# Seed data
cd packages/backend && npx prisma db seed

# Start
npm run dev
```

### Testing

```bash
# Run all tests (127 tests, 4 suites)
cd packages/backend && npm test

# TypeScript check
cd packages/backend && npx tsc --noEmit
cd packages/frontend && npx tsc --noEmit

# Build
cd packages/backend && npm run build
cd packages/frontend && npm run build
```

## Default Credentials

- Username: `admin`
- Password: `admin123`
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api

## Database Schema

6 models with full relations:

| Model | Description |
|-------|-------------|
| User | Admin users (username, password, role) |
| Customer | Customer data (KTP, contact, guarantor, spouse, documents) |
| Contract | RTO contracts (motor, battery, DP, ownership tracking) |
| Invoice | Unified payment records — PMT-xxx (DP, daily, manual, holiday) |
| AuditLog | All mutation operations logged |
| Setting | Configurable system settings |

9 enums: MotorModel, BatteryType, ContractStatus, PaymentStatus, InvoiceType, DPScheme, Gender, AuditAction, UserRole

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Admin login |
| POST | /api/auth/logout | Admin logout |
| GET | /api/auth/me | Get current user |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/dashboard/stats | Dashboard statistics + chart data |

### Customers
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/customers | List customers (paginated) |
| POST | /api/customers | Create customer |
| GET | /api/customers/:id | Get customer detail |
| PUT | /api/customers/:id | Update customer |
| DELETE | /api/customers/:id | Soft delete customer |

### Contracts
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/contracts | List contracts (paginated) |
| POST | /api/contracts | Create contract (with DP invoices) |
| GET | /api/contracts/:id/detail | Contract + customer + invoices detail |
| PUT | /api/contracts/:id | Edit contract (notes, grace period, ownership target, unit details) |
| DELETE | /api/contracts/:id | Soft delete contract |
| PATCH | /api/contracts/:id/status | Update contract status |
| PATCH | /api/contracts/:id/cancel | Cancel contract (with reason) |
| PATCH | /api/contracts/:id/repossess | Repossess motor |
| PATCH | /api/contracts/:id/receive-unit | Mark unit received (requires DP paid + BAST) |
| POST | /api/contracts/:id/pay-billing | Bayar tagihan manual (1-7 hari) |
| GET | /api/contracts/overdue-warnings | Get overdue/near-overdue contracts |
| GET | /api/contracts/customer/:customerId | Contracts by customer |

### Payments (Unified — replaces Invoices + Billings)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/payments | List payments (paginated, filterable) |
| GET | /api/payments/:id | Get payment detail |
| GET | /api/payments/:id/qr | Generate QR code |
| GET | /api/payments/:id/pdf | Download payment as PDF |
| POST | /api/payments/:id/pay | Pay payment (PENDING → PAID) |
| POST | /api/payments/:id/simulate | Simulate payment (dev) |
| PATCH | /api/payments/:id/void | Void payment |
| PATCH | /api/payments/:id/mark-paid | Manual mark as paid |
| PATCH | /api/payments/:id/revert | Revert payment to PENDING |
| PATCH | /api/payments/:id/cancel | Cancel payment (reactivate previous if merged) |
| POST | /api/payments/bulk-pay | Bulk mark payments as paid |
| GET | /api/payments/contract/:contractId | All payments for contract |
| GET | /api/payments/contract/:contractId/active | Active (PENDING) payment |
| GET | /api/payments/contract/:contractId/calendar | Calendar data |
| POST | /api/payments/contract/:contractId/manual | Create manual payment (1-7 days) |
| PATCH | /api/payments/contract/:contractId/day/:date | Admin correction — ubah status PaymentDay |
| POST | /api/payments/:id/reduce | Partial payment — kurangi hari dalam invoice |

### Reports & Export
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reports | Get report data (supports filters) |
| GET | /api/reports/export/json | Export report as JSON |
| GET | /api/reports/export/csv | Export report as CSV |
| GET | /api/reports/export/xlsv | Export report as Excel (TSV) |

### Settings & Audit
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/settings | Get all settings |
| PUT | /api/settings | Update settings |
| GET | /api/settings/rates | Get motor daily rates |
| GET | /api/audit-logs | Get audit logs (paginated) |

### Webhook
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/webhooks/doku | DOKU payment webhook (public, no auth) |

## Seed Data

Production seed script uses static TypeScript data files:
- `prisma/data/customers.ts` — 80 real customers
- `prisma/data/contracts.ts` — 79 contracts (71 active, 6 repossessed, 2 cancelled)

```bash
# First seed or reset
cd packages/backend && npx prisma db seed -- --reset

# Re-run (idempotent, skip if data exists)
cd packages/backend && npx prisma db seed

# Production reset (requires --force)
cd packages/backend && npx prisma db seed -- --reset --force
```

## Deployment

### Backend (Railway)
1. Create Railway project + PostgreSQL addon
2. Set env vars: `CORS_ORIGIN`, `NODE_ENV=production`
3. `railway.json` handles build + start + auto-seed

### Frontend (Vercel)
1. Root directory: `packages/frontend`
2. Set env var: `NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api`

### Git Branching Strategy

```
develop/* ──PR──> staging ──PR──> main (production)
hotfix/*  ──PR──> main (+ backmerge ke staging)
chore/*   ──PR──> staging atau main
```

Branch protection: main + staging require PR + CI pass.

### Environment Variables

**Backend** (`packages/backend/.env`):
```
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://user:pass@localhost:5432/wedison
```

**Frontend** (`packages/frontend/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```
