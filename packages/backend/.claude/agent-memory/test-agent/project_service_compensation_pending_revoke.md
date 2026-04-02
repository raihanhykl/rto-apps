---
name: ServiceCompensation PENDING revoke pattern
description: How revokeServiceRecord re-links PENDING days back to an active invoice after compensation is undone
type: project
---

When `revokeServiceRecord` is called for a record that compensated PENDING days:

1. Days that had `originalStatus: 'PENDING'` in `daySnapshots` are first restored to `UNPAID` (temporarily).
2. Service calls `invoiceRepo.findActiveByContractId()` to find the surviving PENDING invoice.
3. Each originally-PENDING day is re-linked (status=PENDING, paymentId=activeInvoice.id).
4. Invoice is expanded: `daysCount`, `amount`, `periodStart`, `periodEnd`, and `lateFee` are all recalculated from all currently-PENDING days linked to that invoice.

**Critical constraint:** `findActiveByContractId` only returns invoices with `type = DAILY_BILLING | MANUAL_PAYMENT` and `status = PENDING`. If the original invoice was fully voided (all days compensated), this returns null and restored days stay UNPAID — the scheduler picks them up later.

**Why:** Understanding this flow is necessary to set up test fixtures correctly. The invoice must remain PENDING (not fully voided) for re-linking to work. If all days in an invoice are compensated, the invoice is voided and revoke leaves the days as UNPAID.

**How to apply:** When writing revoke tests involving PENDING days, always leave at least one non-compensated PENDING day in the invoice so it stays PENDING and can receive re-linked days on revoke. Or, if testing the "fully voided" path, compensate ALL days and expect UNPAID result after revoke.
