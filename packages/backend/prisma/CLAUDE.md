# CLAUDE.md — Prisma (Database & Seed)

> Instruksi untuk `packages/backend/prisma/`.
> Berisi Prisma schema, migrations, dan seed script.

---

## Prisma Schema

- **File**: `packages/backend/prisma/schema.prisma`
- **Provider**: PostgreSQL (production), SQLite tidak digunakan
- **ORM**: Prisma v6

### Models (6 model)

| Model    | Keterangan                                             |
| -------- | ------------------------------------------------------ |
| User     | Admin user (role: SUPER_ADMIN/ADMIN/VIEWER)            |
| Customer | Data customer (soft delete: isDeleted, deletedAt)      |
| Contract | Kontrak RTO (soft delete, status machine)              |
| Invoice  | Semua pembayaran: DP, harian, manual (unified PMT-xxx) |
| AuditLog | Log semua operasi mutasi                               |
| Setting  | Key-value settings (penalty_grace_days, dll.)          |

### Enums (10 enum)

`MotorModel, BatteryType, ContractStatus, PaymentStatus, InvoiceType, DPScheme, HolidayScheme, Gender, AuditAction, UserRole`

### Naming Convention

- **TypeScript fields**: camelCase
- **Database columns**: snake_case via `@map("column_name")`
- **Table names**: snake_case via `@@map("table_name")`

```prisma
model Contract {
  id              String   @id @default(cuid())
  contractNumber  String   @unique @map("contract_number")
  totalDaysPaid   Int      @default(0) @map("total_days_paid")

  @@map("contracts")
}
```

### Prisma Client

- Singleton di `src/infrastructure/prisma/client.ts`
- JANGAN buat `new PrismaClient()` di tempat lain.

---

## Migrations (WAJIB pakai Migrate, bukan db push)

- **Workflow**: Prisma Migrate dengan versioned migrations
- **Directory**: `prisma/migrations/`
- **Baseline**: `0_init` — mencakup seluruh schema awal

### Commands

```bash
# Buat migration baru setelah ubah schema
cd packages/backend && npx prisma migrate dev --name deskripsi_singkat

# Apply migrations di production (Railway otomatis jalankan ini)
cd packages/backend && npx prisma migrate deploy

# Generate Prisma Client (setelah ubah schema, sebelum build)
cd packages/backend && npx prisma generate

# GUI browser
cd packages/backend && npx prisma studio
```

### Alur Kerja Schema Change

1. Edit `prisma/schema.prisma`
2. `npx prisma migrate dev --name nama_perubahan` → buat migration file baru
3. Migration auto-apply ke local database
4. Commit schema + migration file ke git
5. Deploy ke Railway → `migrate deploy` otomatis berjalan

**JANGAN gunakan `db push`** untuk production — tidak aman, tidak versioned.

---

## Seed Script

### Overview

- **File utama**: `packages/backend/prisma/seed.ts`
- **Data source**: Static TypeScript files di `prisma/data/` (bukan CSV)
- **Idempotent**: Aman dijalankan berulang kali tanpa duplikasi data

### Data Files

| File                | Konten                                 |
| ------------------- | -------------------------------------- |
| `data/customers.ts` | 80 customers, interface `CustomerSeed` |
| `data/contracts.ts` | 79 contracts, interface `ContractSeed` |

**Type `DateTuple` untuk contracts**: `[year, month, day]` — bulan 1-indexed (Januari = 1).

```typescript
// Contoh: 30 Desember 2025
startDate: [2025, 12, 30];
```

**Format tanggal customers**: ISO string `"2001-08-25"` (untuk birthDate).

### Commands Seed

```bash
# Development: insert jika belum ada, skip duplikat
cd packages/backend && npx prisma db seed

# Development: hapus semua + insert ulang
cd packages/backend && npx prisma db seed -- --reset

# Production: --reset tanpa --force akan DITOLAK (safety guard)
cd packages/backend && npx prisma db seed -- --reset --force
```

### Behavior Idempotent

| Data       | Strategi                                                   |
| ---------- | ---------------------------------------------------------- |
| Admin user | `upsert` — selalu aman                                     |
| Settings   | `upsert` — selalu aman, migrateSettings() auto-update lama |
| Customer   | Cek KTP number → skip jika sudah ada                       |
| Contract   | Cek `contract.count()` → skip semua jika sudah ada data    |

Tanpa `--reset`: **TIDAK menghapus data apapun**.

### Menambah Data Seed Baru

1. Edit file di `prisma/data/` — ikuti interface yang ada
2. Cek interface `CustomerSeed` atau `ContractSeed` untuk field yang wajib
3. `totalDaysPaid: null` = unit belum diterima (belum ada billing history)
4. Jalankan `npx prisma db seed` untuk test local
5. Deploy + jalankan `--reset --force` di server jika data lama perlu diganti

---

## Railway Deployment

Railway auto-run saat deploy (via `railway.json` startCommand):

```
prisma migrate deploy → prisma db seed → node dist/index.js
```

- Migrations di-apply otomatis setiap deploy.
- Seed berjalan otomatis tapi idempotent (skip jika data sudah ada).
- **Reset production data** HANYA via manual command SSH: `--reset --force`.
- `DATABASE_URL` disediakan otomatis oleh Railway PostgreSQL addon.
