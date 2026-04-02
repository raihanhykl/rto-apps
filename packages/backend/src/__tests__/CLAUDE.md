# CLAUDE.md — Unit Tests (Backend)

> Instruksi untuk `packages/backend/src/__tests__/`.
> Semua unit tests backend ada di sini menggunakan Jest + ts-jest.

---

## Tech Stack Testing

- **Framework**: Jest + ts-jest
- **Config**: `jest.config.js` di root `packages/backend/`
- **Run**: `cd packages/backend && npm test`
- **Watch**: `cd packages/backend && npm test -- --watch`
- **Coverage**: `cd packages/backend && npm test -- --coverage`

---

## Aturan Unit Testing (WAJIB)

1. **SELALU gunakan InMemory repositories** — TIDAK BOLEH menggunakan Prisma atau database real.
2. **WAJIB tambah/update tests** saat menambah fitur baru atau mengubah business logic.
3. Setiap service harus punya test suite sendiri.
4. Tests harus independent — tidak boleh saling bergantung antar test case.
5. Gunakan `beforeEach` untuk reset state (buat repository baru) — jangan share state antar tests.

---

## Test Suites yang Ada

| File                                 | Suite                      | Jumlah Test (approx) |
| ------------------------------------ | -------------------------- | -------------------- |
| `auth.test.ts`                       | AuthService                | ~20 tests            |
| `customer.test.ts`                   | CustomerService            | ~35 tests            |
| `contract.test.ts`                   | ContractService            | ~50 tests            |
| `payment.test.ts`                    | PaymentService             | ~70 tests            |
| `saving.test.ts`                     | SavingService              | ~25 tests            |
| `ServiceCompensationService.test.ts` | ServiceCompensationService | 30 tests             |

**Total: ~230 tests** saat ini.

---

## Pattern Test yang Benar

```typescript
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryPaymentRepository } from '../infrastructure/repositories/InMemoryPaymentRepository';
import { ContractService } from '../application/services/ContractService';

describe('ContractService', () => {
  let contractRepo: InMemoryContractRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let contractService: ContractService;

  beforeEach(() => {
    // Reset semua state setiap test
    contractRepo = new InMemoryContractRepository();
    paymentRepo = new InMemoryPaymentRepository();
    contractService = new ContractService(contractRepo, paymentRepo);
  });

  describe('cancelContract', () => {
    it('should void all pending invoices when cancelling', async () => {
      // Arrange
      const contract = await contractRepo.create({ ... });
      // Act
      await contractService.cancelContract(contract.id, 'alasan');
      // Assert
      const invoices = await paymentRepo.findByContractId(contract.id);
      expect(invoices.every(inv => inv.status === 'VOID')).toBe(true);
    });
  });
});
```

---

## Coverage Guidelines

- **Business logic** (services) harus memiliki coverage tinggi (>80%).
- Test semua **edge cases** business rules:
  - DP installment rounding (ceil vs floor)
  - Libur Bayar OLD_CONTRACT (Minggu) vs NEW_CONTRACT (29-31)
  - Rollover mechanism
  - Late fee calculation dengan berbagai skenario
  - Contract status transitions (valid vs invalid)
- **Error paths** harus di-test — test bahwa fungsi throw error yang tepat saat input invalid.

---

## Menambah Test untuk Fitur Baru

Saat menambah fitur baru:

1. Buat test file baru atau tambah ke file yang relevan.
2. Pastikan ada test untuk **happy path** dan **error path**.
3. Untuk business logic kompleks (libur bayar, late fee, rollover) → buat describe block terpisah.
4. Update jumlah test di `packages/backend/CLAUDE.md` dan `MEMORY.md` setelah selesai.
5. Jalankan `npm test` dan pastikan semua tests pass sebelum commit.

---

## Menjalankan Test Subset

```bash
# Hanya satu file
cd packages/backend && npm test -- payment.test.ts

# Pattern matching
cd packages/backend && npm test -- --testPathPattern="contract"

# Satu describe/it block
cd packages/backend && npm test -- --testNamePattern="cancelContract"

# Verbose output
cd packages/backend && npm test -- --verbose
```
