---
name: Current Test Count
description: Total unit test count across all backend test suites
type: project
---

Total: **230 tests** passing (as of 2026-03-26)

| File                                   | Suite                      | Count  |
| -------------------------------------- | -------------------------- | ------ |
| `auth.test.ts`                         | AuthService                | ~20    |
| `customer.test.ts`                     | CustomerService            | ~35    |
| `contract.test.ts`                     | ContractService            | ~50    |
| `payment.test.ts`                      | PaymentService             | ~70    |
| `saving.test.ts`                       | SavingService              | ~25    |
| `ServiceCompensationService.test.ts`   | ServiceCompensationService | 30     |

**Why:** ServiceCompensationService test suite added in branch `develop/compensation-for-bike-service`

**How to apply:** When asked about test count, use 230 as the baseline. Verify with `cd packages/backend && npm test` before claiming any number.
