# CLAUDE.md — Domain Layer

> Instruksi untuk `packages/backend/src/domain/`.
> Layer paling murni dalam Clean Architecture — TIDAK BOLEH bergantung ke layer manapun.

---

## Aturan Domain Layer (WAJIB)

**Domain layer adalah inti — tidak boleh tahu apapun tentang Express, Prisma, HTTP, atau framework lain.**

- `src/domain/` TIDAK BOLEH import dari:
  - `src/application/`
  - `src/infrastructure/`
  - `src/presentation/`
  - Library eksternal yang framework-specific (Express, Prisma, dll.)
- Boleh import: Node.js built-ins murni (misal `path`, `crypto`), dan antar-file dalam domain sendiri.

---

## Struktur Domain Layer

```
src/domain/
├── entities/        # TypeScript interfaces/types untuk data model
├── enums/           # Semua enum yang digunakan lintas layer
├── interfaces/      # Repository contracts (ICustomerRepository, dll.)
├── utils/           # Pure utility functions (no side effects, no DB)
└── constants/       # Business constants (ownershipTargetDays, dll.)
```

### Entities (`domain/entities/`)

- Definisi interface/type untuk data model utama.
- Murni TypeScript — tidak ada method, hanya data shapes.
- Contoh: `Customer.ts`, `Contract.ts`, `Invoice.ts`, `PaymentDay.ts`.
- Field naming: camelCase di TypeScript (Prisma handle snake_case mapping via `@map`).

### Enums (`domain/enums/`)

- Semua enum yang dipakai di lebih dari satu layer harus ada di sini.
- Enum yang ada:
  - `MotorModel` — jenis motor (ATHENA, VICTORY, ED_POWER)
  - `BatteryType` — jenis baterai (REGULAR, EXTENDED)
  - `ContractStatus` — ACTIVE, OVERDUE, COMPLETED, CANCELLED, REPOSSESSED
  - `PaymentStatus` — PENDING, PAID, EXPIRED, VOID, FAILED
  - `InvoiceType` — DP, DP_INSTALLMENT, DAILY, MANUAL
  - `DPScheme` — FULL, INSTALLMENT
  - `HolidayScheme` — OLD_CONTRACT, NEW_CONTRACT
  - `Gender` — MALE, FEMALE
  - `AuditAction` — CREATE, UPDATE, DELETE, PAYMENT, dll.
  - `UserRole` — SUPER_ADMIN, ADMIN, VIEWER

### Repository Interfaces (`domain/interfaces/`)

- Contracts yang harus diimplementasikan oleh Infrastructure layer.
- Format: `I[Entity]Repository` (contoh: `IContractRepository`).
- Hanya definisi method signatures — tidak ada implementasi.
- **Saat menambah method baru di interface → HARUS update kedua implementasi di infrastructure.**

### Utility Functions (`domain/utils/`)

- Pure functions — tidak ada I/O, tidak ada async/database calls.
- File yang ada:
  - `lateFeeCalculator.ts` — `computeLateFee()` pure function untuk kalkulasi denda
  - `dateUtils.ts` — `toDateKey()` dan utilities tanggal lainnya

#### `computeLateFee()` di `lateFeeCalculator.ts`

```typescript
// Signature:
computeLateFee(params: {
  dailyRates: number[],    // tarif per hari untuk setiap hari yang kena denda
  penaltyGraceDays: number, // toleransi hari sebelum denda berlaku
  lateFeePerDay: number,   // nominal denda per hari
}): number
```

- Shared oleh `PaymentService` dan `ContractService`.
- `PaymentService.calculateLateFee()` adalah async wrapper yang baca setting lalu panggil ini.
- Denda hanya berlaku untuk `NEW_CONTRACT` — check dilakukan di caller sebelum memanggil fungsi ini.

#### `toDateKey()` di `dateUtils.ts`

```typescript
// Gunakan ini untuk konversi Date → string key "YYYY-MM-DD"
// JANGAN pakai toISOString() — bisa timezone shift!
toDateKey(date: Date): string
// menggunakan: date.getFullYear(), date.getMonth(), date.getDate()
```

---

## Constants (`domain/constants/`)

- `OWNERSHIP_TARGET_DAYS = 1278` — target hari kepemilikan
- Pricing constants (daily rates, DP amounts per motor+battery combo)

---

## Checklist Saat Menambah Entity Baru

1. Buat interface di `domain/entities/NewEntity.ts`
2. Tambah enum baru (jika perlu) di `domain/enums/`
3. Buat repository interface di `domain/interfaces/INewEntityRepository.ts`
4. Implementasikan di `src/infrastructure/repositories/`:
   - `InMemoryNewEntityRepository.ts`
   - `PrismaNewEntityRepository.ts`
5. Tambah ke Prisma schema (`prisma/schema.prisma`) → migrate dev
6. Inject ke service via constructor (bukan langsung import concrete)
