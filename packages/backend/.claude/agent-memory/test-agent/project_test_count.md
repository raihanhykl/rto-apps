---
name: Test Count
description: Total unit tests across all suites — update when tests are added
type: project
---

Total: **234 tests** (as of 2026-03-26)

| Suite                                | File                                      | Tests |
|--------------------------------------|-------------------------------------------|-------|
| AuthService                          | `auth.test.ts`                            | ~20   |
| CustomerService                      | `customer.test.ts`                        | ~35   |
| ContractService                      | `contract.test.ts`                        | ~50   |
| PaymentService                       | `payment.test.ts`                         | ~70   |
| SavingService                        | `saving.test.ts`                          | ~25   |
| ServiceCompensationService           | `ServiceCompensationService.test.ts`      | 34    |

**Why:** Track test growth to ensure coverage doesn't regress during refactors.
**How to apply:** Update this file after adding tests. Also update `packages/backend/CLAUDE.md` and root `MEMORY.md`.
