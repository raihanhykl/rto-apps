import { BillingStatus } from '../enums';

export interface Billing {
  id: string;
  billingNumber: string; // BIL-YYMMDD-NNNN
  contractId: string;
  customerId: string;
  amount: number; // total amount (may accumulate via rollover)
  dailyRate: number; // rate per day
  daysCount: number; // number of days covered
  status: BillingStatus; // ACTIVE, PAID, EXPIRED, CANCELLED
  dokuPaymentUrl: string | null;
  dokuReferenceId: string | null;
  periodStart: Date; // first day of billing period
  periodEnd: Date; // last day of billing period
  expiredAt: Date | null; // when billing was expired (rollover)
  paidAt: Date | null;
  invoiceId: string | null; // reference to generated invoice (when PAID)
  previousBillingId: string | null; // reference to previous billing (for merged manual billings)
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
