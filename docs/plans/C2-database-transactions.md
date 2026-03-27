# C2 — Database Transactions untuk Multi-Step Operations

> **Planning document untuk dedicated session.**
> Gunakan Agent Teams untuk implementasi paralel.

---

## Background & Context

### Project Overview

WEDISON RTO — Internal Rent-To-Own management system untuk motor listrik. Monorepo (npm workspaces): `packages/backend` (Express + TypeScript, Clean Architecture) dan `packages/frontend` (Next.js 16).

### Audit Progress

Audit robustness & scalability menghasilkan 42 temuan. **Wave 1-4 sudah selesai dan verified** (234 unit tests pass, 0 TS errors). Item C2 di-DEFERRED karena blast radius tinggi — sekarang siap dikerjakan dengan dedicated session.

### Apa yang Sudah Dikerjakan (Jangan Ulangi!)

- **C1 + H12**: SequenceGenerator singleton — nomor kontrak/invoice sudah aman dari race condition
- **C4**: `atomicDecrementSavingBalance()` — saving balance sudah atomic di DB level
- **C8**: PostgreSQL advisory lock di Scheduler — distributed lock sudah ada
- **H1**: Batch pre-fetch di generateDailyPayments — N+1 sudah di-fix
- **H2 + M1-M3**: Database composite indexes sudah ditambahkan
- **H5**: Rate limiting sudah aktif
- **H9**: Scheduler per-step error isolation sudah ada

### Branch

Kerjakan di branch baru dari `develop/create-manual-job-trigger-button` (branch aktif saat ini) atau buat branch `develop/C2-database-transactions`.

---

## Constraint (WAJIB)

1. **TIDAK mengubah business logic** — output bisnis harus identik sebelum dan sesudah
2. **Semua 234 test HARUS pass** setelah setiap perubahan
3. **InMemory repository tetap konsisten** — setiap interface change harus diimplementasi di kedua varian
4. **Backward compatible** — API response shape tidak berubah
5. **Satu commit per task** — mudah revert jika ada masalah

---

## Problem Statement

Banyak operasi di service layer melakukan **multiple DB writes secara sequential tanpa transaction**. Jika salah satu step gagal di tengah, data menjadi inconsistent.

### Operasi yang Terdampak (Prioritas Tinggi → Rendah)

| #   | Service             | Method                             | Steps                                                                                | Risk                                            |
| --- | ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| 1   | PaymentService      | `rolloverPayment()` (L570-707)     | EXPIRE old invoice → unlink PaymentDay → create new invoice → link PaymentDay        | **CRITICAL** — invoice hilang jika step 3 gagal |
| 2   | PaymentService      | `payPayment()` (L711-781)          | Update invoice PAID → update PaymentDay → sync contract → credit saving → audit      | HIGH — invoice PAID tapi contract tidak update  |
| 3   | PaymentService      | `createManualPayment()` (L853-965) | Void old invoice → unlink PaymentDay → create new invoice → link PaymentDay → audit  | HIGH — sama seperti rollover                    |
| 4   | ContractService     | `create()` (L91-281)               | Create contract → create 1-2 DP invoices → audit                                     | HIGH — contract tanpa DP invoice                |
| 5   | ContractService     | `receiveUnit()` (L283-392)         | Update contract → generate 60 PaymentDay → audit                                     | HIGH — contract tanpa billing records           |
| 6   | ContractService     | `repossess()` (L494-561)           | Void invoices → void PaymentDay → update contract → audit                            | HIGH — partial void                             |
| 7   | ContractService     | `cancelContract()` (L599-666)      | Void invoices → void PaymentDay → update contract → audit                            | HIGH — sama seperti repossess                   |
| 8   | ServiceCompensation | `createServiceRecord()` (L52-337)  | Update multiple PaymentDay → shift PAID days → create record → sync contract → audit | **CRITICAL** — partial compensation             |
| 9   | ServiceCompensation | `revokeServiceRecord()` (L341-470) | Restore PaymentDay → relink invoice → update record → sync contract → audit          | HIGH — partial restore                          |
| 10  | SavingService       | `creditFromPayment()` (L38-95)     | Create saving tx → update balance → audit                                            | MEDIUM — balance mismatch                       |

---

## Architecture Design: ITransactionManager

### Pattern: Callback-Based Transaction Manager

Dipilih karena kompatibel dengan Prisma `$transaction()` API yang callback-based.

```typescript
// src/domain/interfaces/ITransactionManager.ts

export interface TransactionalRepos {
  contractRepo: IContractRepository;
  invoiceRepo: IInvoiceRepository;
  paymentDayRepo: IPaymentDayRepository;
  auditRepo: IAuditLogRepository;
  savingTxRepo: ISavingTransactionRepository;
  serviceRecordRepo: IServiceRecordRepository;
  customerRepo: ICustomerRepository;
  settingRepo: ISettingRepository;
}

export interface ITransactionManager {
  /**
   * Execute a function within a database transaction.
   * All repository operations inside the callback use the same transaction.
   * If the callback throws, all changes are rolled back.
   */
  runInTransaction<T>(fn: (repos: TransactionalRepos) => Promise<T>): Promise<T>;
}
```

### Prisma Implementation

```typescript
// src/infrastructure/transactions/PrismaTransactionManager.ts

export class PrismaTransactionManager implements ITransactionManager {
  constructor(private prisma: PrismaClient) {}

  async runInTransaction<T>(fn: (repos: TransactionalRepos) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        // Create fresh repository instances bound to the transaction client
        const repos: TransactionalRepos = {
          contractRepo: new PrismaContractRepository(tx as PrismaClient),
          invoiceRepo: new PrismaInvoiceRepository(tx as PrismaClient),
          paymentDayRepo: new PrismaPaymentDayRepository(tx as PrismaClient),
          auditRepo: new PrismaAuditLogRepository(tx as PrismaClient),
          savingTxRepo: new PrismaSavingTransactionRepository(tx as PrismaClient),
          serviceRecordRepo: new PrismaServiceRecordRepository(tx as PrismaClient),
          customerRepo: new PrismaCustomerRepository(tx as PrismaClient),
          settingRepo: new PrismaSettingRepository(tx as PrismaClient),
        };
        return fn(repos);
      },
      {
        timeout: 30000, // 30 second timeout for complex operations
      },
    );
  }
}
```

### InMemory Implementation

```typescript
// src/infrastructure/transactions/InMemoryTransactionManager.ts

export class InMemoryTransactionManager implements ITransactionManager {
  constructor(private repos: TransactionalRepos) {}

  async runInTransaction<T>(fn: (repos: TransactionalRepos) => Promise<T>): Promise<T> {
    // InMemory: no real transaction, just pass through existing repos
    return fn(this.repos);
  }
}
```

### Service Integration Pattern

Services mendapat `txManager` sebagai optional constructor parameter (backward compatible):

```typescript
class PaymentService {
  constructor(
    private invoiceRepo: IInvoiceRepository,
    private contractRepo: IContractRepository,
    private paymentDayRepo: IPaymentDayRepository,
    private auditRepo: IAuditLogRepository,
    private settingService?: SettingService,
    private txManager?: ITransactionManager,  // NEW
  ) {}

  async payPayment(paymentId: string, adminId: string): Promise<Invoice> {
    // Reads OUTSIDE transaction (consistent snapshot not critical for reads)
    const payment = await this.invoiceRepo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    // ... validation ...

    // Writes INSIDE transaction
    const writeOps = async (repos: TransactionalRepos) => {
      const updated = await repos.invoiceRepo.update(paymentId, {
        status: PaymentStatus.PAID, paidAt: new Date(),
      });
      if (!updated) throw new Error('Failed to update payment');

      await repos.paymentDayRepo.updateManyByPaymentId(payment.id, {
        status: PaymentDayStatus.PAID,
      });

      // ... more writes using repos.* ...

      await repos.auditRepo.create({ ... });
      return updated;
    };

    if (this.txManager) {
      return this.txManager.runInTransaction(writeOps);
    } else {
      // Fallback: existing behavior (untuk InMemory tests yang belum inject txManager)
      return writeOps({
        contractRepo: this.contractRepo,
        invoiceRepo: this.invoiceRepo,
        paymentDayRepo: this.paymentDayRepo,
        auditRepo: this.auditRepo,
        savingTxRepo: null as any, // not used in this method
        serviceRecordRepo: null as any,
        customerRepo: null as any,
        settingRepo: null as any,
      });
    }
  }
}
```

### Catatan Penting: syncContractFromPaymentDays

`syncContractFromPaymentDays()` dipanggil di dalam `payPayment()`, `rolloverPayment()`, dll. Method ini melakukan **reads + writes** (baca PaymentDay → calculate → update contract). Saat di-wrap dalam transaction:

- Harus pakai `repos.paymentDayRepo` dan `repos.contractRepo` dari TransactionalRepos
- Artinya `syncContractFromPaymentDays` perlu di-refactor agar bisa menerima repos parameter

Opsi: buat private method `syncContractFromPaymentDaysWithRepos(contractId, repos)` yang menerima TransactionalRepos.

### Catatan: SavingService Cross-Service Call

`payPayment()` memanggil `this.savingService.creditFromPayment()`. Ini cross-service call. Dua opsi:

1. **Inline saving logic** di dalam transaction callback (copy logic, tidak ideal)
2. **SavingService juga terima txManager** dan pass repos dari luar — lebih clean tapi butuh refactor SavingService juga
3. **Keeping saving outside transaction** (current behavior) — saving credit failure sudah di-try-catch dan tidak menggagalkan payment. Ini acceptable karena:
   - Saving credit failure sudah handled gracefully
   - Data inconsistency hanya di saving balance (bisa di-reconcile)
   - Risiko jauh lebih rendah dari payment/contract inconsistency

**Rekomendasi**: Opsi 3 untuk sekarang — saving tetap di luar transaction. Focus transaction pada core payment/contract operations.

---

## Agent Teams Setup

### Enable Agent Teams

Tambahkan ke settings:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Prompt untuk Team Lead

```
Saya ingin mengimplementasi database transactions (C2) untuk WEDISON RTO project.

Baca planning document di docs/plans/C2-database-transactions.md untuk full context, architecture design, dan task breakdown.

Buat team dengan 4 teammates:
1. "foundation" — buat ITransactionManager interface + implementasi (Prisma + InMemory) + wire up di index.ts
2. "payment-service" — refactor PaymentService methods (payPayment, rolloverPayment, createManualPayment) untuk gunakan txManager
3. "contract-service" — refactor ContractService methods (create, receiveUnit, repossess, cancelContract) untuk gunakan txManager
4. "compensation-service" — refactor ServiceCompensationService (createServiceRecord, revokeServiceRecord) + SavingService methods

Task dependencies:
- "foundation" harus selesai dulu sebelum 3 service teammates mulai
- 3 service teammates bisa berjalan paralel (file berbeda, tidak conflict)

Setiap teammate harus: baca planning doc dulu, ikuti architecture pattern yang sudah di-design, JANGAN ubah business logic, dan verify dengan `npx tsc --noEmit` setelah selesai.

Setelah semua teammate selesai, lead harus: jalankan `cd packages/backend && npm test` untuk verify semua 234 test pass.
```

### Team Structure & File Ownership

| Teammate             | Files yang Dimiliki (HANYA edit file ini)                                                                                                                                                                                                       | Dependency           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| foundation           | `src/domain/interfaces/ITransactionManager.ts` (NEW), `src/infrastructure/transactions/PrismaTransactionManager.ts` (NEW), `src/infrastructure/transactions/InMemoryTransactionManager.ts` (NEW), `src/index.ts` (inject txManager ke services) | None — mulai pertama |
| payment-service      | `src/application/services/PaymentService.ts`                                                                                                                                                                                                    | foundation selesai   |
| contract-service     | `src/application/services/ContractService.ts`                                                                                                                                                                                                   | foundation selesai   |
| compensation-service | `src/application/services/ServiceCompensationService.ts`, `src/application/services/SavingService.ts`                                                                                                                                           | foundation selesai   |

> **PENTING**: Tidak ada teammate yang edit test files. Test harus tetap pass tanpa perubahan karena:
>
> - txManager optional (backward compatible)
> - InMemory tests tidak inject txManager → fallback ke existing behavior
> - Business logic tidak berubah

### Task Breakdown (untuk Agent Teams task list)

#### Task 1: Foundation — ITransactionManager Interface (foundation)

**Priority**: 1 (harus selesai pertama)
**Files**:

- CREATE `src/domain/interfaces/ITransactionManager.ts`
- EDIT `src/domain/interfaces/index.ts` (re-export)

**Detail**:

- Definisikan `TransactionalRepos` interface (semua repository interfaces)
- Definisikan `ITransactionManager` interface dengan method `runInTransaction<T>`
- Export dari barrel file

#### Task 2: Foundation — Prisma + InMemory Implementations (foundation)

**Priority**: 2 (setelah task 1)
**Files**:

- CREATE `src/infrastructure/transactions/PrismaTransactionManager.ts`
- CREATE `src/infrastructure/transactions/InMemoryTransactionManager.ts`
- CREATE `src/infrastructure/transactions/index.ts` (barrel)

**Detail**:

- PrismaTransactionManager: wrap `prisma.$transaction()`, create fresh repos per transaction, timeout 30s
- InMemoryTransactionManager: passthrough, no real transaction
- Export kedua implementasi

#### Task 3: Foundation — Wire Up di index.ts (foundation)

**Priority**: 3 (setelah task 2)
**Files**:

- EDIT `src/index.ts`

**Detail**:

- Import TransactionManager implementations
- Create txManager instance (Prisma atau InMemory sesuai DATABASE_URL)
- Pass txManager ke semua service constructors yang butuh
- Verify `npx tsc --noEmit` pass

#### Task 4: Refactor PaymentService.payPayment() (payment-service)

**Priority**: 4 (setelah task 3)
**Files**: `src/application/services/PaymentService.ts`

**Detail**:

- Tambah `txManager?: ITransactionManager` ke constructor
- Refactor `payPayment()`: wrap writes (invoice update, PaymentDay update, syncContract, audit) dalam `txManager.runInTransaction()`
- Saving credit tetap di LUAR transaction (sudah di-try-catch)
- Buat helper `syncContractFromPaymentDaysWithRepos()` yang terima TransactionalRepos

#### Task 5: Refactor PaymentService.rolloverPayment() (payment-service)

**Priority**: 4 (paralel dengan task 4)
**Files**: `src/application/services/PaymentService.ts`

**Detail**:

- Wrap semua writes dalam transaction: EXPIRE old invoice → unlink PaymentDay → create new invoice → link PaymentDay
- Hapus manual try-catch recovery (L687-706) — transaction auto-rollback sudah handle ini
- Ini fix paling kritikal — rollover tanpa transaction bisa orphan invoice

#### Task 6: Refactor PaymentService.createManualPayment() (payment-service)

**Priority**: 4 (paralel dengan task 4-5)
**Files**: `src/application/services/PaymentService.ts`

**Detail**:

- Wrap writes: void old invoice → unlink PaymentDay → create new invoice → link PaymentDay → audit

#### Task 7: Refactor ContractService.create() (contract-service)

**Priority**: 4 (paralel, setelah task 3)
**Files**: `src/application/services/ContractService.ts`

**Detail**:

- Tambah `txManager?: ITransactionManager` ke constructor
- Wrap: create contract → create DP invoices (1 atau 2) → audit

#### Task 8: Refactor ContractService.receiveUnit() (contract-service)

**Priority**: 4
**Files**: `src/application/services/ContractService.ts`

**Detail**:

- Wrap: update contract → generate 60 PaymentDay records → audit

#### Task 9: Refactor ContractService.repossess() + cancelContract() (contract-service)

**Priority**: 4
**Files**: `src/application/services/ContractService.ts`

**Detail**:

- Keduanya pattern sama: void invoices → void PaymentDay → update contract status → audit
- Wrap masing-masing dalam transaction

#### Task 10: Refactor ServiceCompensationService (compensation-service)

**Priority**: 4 (paralel, setelah task 3)
**Files**: `src/application/services/ServiceCompensationService.ts`

**Detail**:

- Tambah `txManager?: ITransactionManager` ke constructor
- `createServiceRecord()`: wrap all PaymentDay updates + shift operations + record creation + sync + audit
- `revokeServiceRecord()`: wrap all restores + invoice relink + record update + sync + audit
- Ini operasi paling kompleks — banyak step, harus hati-hati

#### Task 11: Refactor SavingService debit methods (compensation-service)

**Priority**: 4
**Files**: `src/application/services/SavingService.ts`

**Detail**:

- Tambah `txManager?: ITransactionManager` ke constructor
- `creditFromPayment()`, `reverseCreditFromPayment()`, `debitForService()`, `debitForTransfer()`, `claimSaving()`: wrap transaction saving tx → balance update → audit
- Note: `atomicDecrementSavingBalance` sudah atomic, tapi masih bisa ada gap antara saving tx record dan balance update

#### Task 12: Final Verification (lead)

**Priority**: 5 (setelah semua task selesai)

**Commands**:

```bash
cd packages/backend && npx tsc --noEmit    # 0 errors
cd packages/backend && npm test            # 234 tests pass
npm run lint:backend                       # no new warnings
```

---

## Verification Checklist

Setelah semua task selesai:

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm test` — 234/234 pass (TIDAK BOLEH ada test baru yang gagal)
- [ ] `npm run lint:backend` — no new errors
- [ ] Business logic tidak berubah — semua method masih return output yang sama
- [ ] InMemory mode (tanpa DATABASE_URL) masih berfungsi normal
- [ ] Prisma mode: multi-step operations wrapped dalam `$transaction()`
- [ ] Rollover recovery try-catch dihapus (replaced by transaction rollback)
- [ ] No new test files needed (txManager optional, tests use InMemory fallback)

---

## Risiko & Mitigasi

| Risiko                                                        | Mitigasi                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Transaction timeout pada operasi besar (compensation 30 hari) | Set timeout 30s, monitor di production                                   |
| Prisma `tx` client type mismatch                              | Cast `tx as PrismaClient` — Prisma interactive tx client compatible      |
| Test failures karena constructor signature change             | txManager optional, existing tests tidak inject → fallback               |
| syncContractFromPaymentDays perlu refactor                    | Buat wrapper method yang terima repos, internal method tetap sama        |
| Deadlock saat concurrent transactions                         | Prisma handles via retry + timeout, advisory lock sudah ada di scheduler |

---

## Files Reference

### Domain Layer

- `src/domain/interfaces/IContractRepository.ts` — IContractRepository interface
- `src/domain/interfaces/IInvoiceRepository.ts` — IInvoiceRepository interface
- `src/domain/interfaces/IPaymentDayRepository.ts` — IPaymentDayRepository interface
- `src/domain/interfaces/IAuditLogRepository.ts` — IAuditLogRepository interface
- `src/domain/interfaces/ISavingTransactionRepository.ts` — ISavingTransactionRepository interface
- `src/domain/interfaces/IServiceRecordRepository.ts` — IServiceRecordRepository interface
- `src/domain/interfaces/index.ts` — barrel export

### Application Layer (services to refactor)

- `src/application/services/PaymentService.ts` — constructor L42-48, payPayment L711-781, rolloverPayment L570-707, createManualPayment L853-965
- `src/application/services/ContractService.ts` — constructor L44-51, create L91-281, receiveUnit L283-392, repossess L494-561, cancelContract L599-666
- `src/application/services/ServiceCompensationService.ts` — constructor L27-34, createServiceRecord L52-337, revokeServiceRecord L341-470
- `src/application/services/SavingService.ts` — constructor L27-32, creditFromPayment L38-95, debitForService L179-248

### Infrastructure Layer

- `src/infrastructure/repositories/Prisma*.ts` — 9 Prisma repository files (all accept PrismaClient in constructor)
- `src/infrastructure/repositories/InMemory*.ts` — 9 InMemory repository files
- `src/index.ts` — dependency injection wiring (L1-250+)

### Test Files (JANGAN ubah)

- `src/__tests__/contract.test.ts`
- `src/__tests__/payment.test.ts`
- `src/__tests__/saving.test.ts`
- `src/__tests__/auth.test.ts`
- `src/__tests__/customer.test.ts`
- `src/__tests__/serviceCompensation.test.ts`
