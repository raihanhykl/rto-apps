---
name: Service Compensation Test Patterns
description: Setup, helpers, and key findings for ServiceCompensationService tests
type: project
---

## Setup Pattern

ServiceCompensationService requires 6 dependencies:
1. `InMemoryServiceRecordRepository`
2. `InMemoryPaymentDayRepository`
3. `InMemoryContractRepository`
4. `InMemoryInvoiceRepository`
5. `InMemoryAuditLogRepository`
6. `PaymentService` (constructed with SettingService internally)

PaymentService is NOT mocked — it is instantiated with a real InMemorySettingRepository so `isLiburBayar()` and `syncContractFromPaymentDays()` work correctly.

## Helper Functions Needed

- `createTestContract(overrides)` — returns a full Contract object with sensible defaults
- `createTestInvoice(contractId, overrides)` — returns Invoice with PENDING status
- `createTestPaymentDay(contractId, date, status, overrides)` — note: amount should be 58000 for PAID/UNPAID, 0 for HOLIDAY/COMPENSATED

## Key Behavior Verified

1. MINOR or MAJOR+replacement: compensationDays=0, daySnapshots=null
2. MAJOR+no replacement: walks each day, converts UNPAID/PENDING/PAID to COMPENSATED
3. PAID days get shifted forward after endDate — skipping holiday dates (date > 28 for NEW_CONTRACT)
4. VOIDED and HOLIDAY days are skipped entirely during compensation
5. When a PENDING day is compensated, its invoice is voided (if sole remaining day) or reduced
6. Revoke restores originalStatus from daySnapshots; shifted PAID days revert to UNPAID
7. Overlap detection uses `findActiveByContractAndDateRange` — REVOKED records don't block

## Shift Target Calculation

- After endDate, first available non-holiday slot is endDate + 1
- For service record Jan 5-6 (2 PAID days), shift targets are Jan 7 and Jan 8 (not Jan 8 and Jan 9)
- This was a bug in initial test assertion that was corrected

**Why:** endDate is Jan 6, so `findNextUnpaidDays` starts from Jan 7 (endDate + 1)

## Test File Location

`packages/backend/src/__tests__/ServiceCompensationService.test.ts` — 30 tests
