import { PaymentStatus, InvoiceType } from '../enums';

export interface Invoice {
  id: string;
  invoiceNumber: string; // PMT-YYMMDD-NNNN
  contractId: string;
  customerId: string;
  amount: number;
  lateFee: number; // late fee amount (0 if not overdue)
  type: InvoiceType; // DP, DP_INSTALLMENT, DAILY_BILLING, MANUAL_PAYMENT
  status: PaymentStatus;
  qrCodeData: string;
  dueDate: Date;
  paidAt: Date | null;
  extensionDays: number | null; // days to add to contract when paid

  // DOKU payment gateway
  dokuPaymentUrl: string | null;
  dokuReferenceId: string | null;

  // Billing/payment period (for daily billing and manual payments)
  dailyRate: number | null;
  daysCount: number | null; // number of working days covered
  periodStart: Date | null;
  periodEnd: Date | null;
  expiredAt: Date | null; // when payment was expired (rollover)
  previousPaymentId: string | null; // reference to previous payment (for merged/rollover)
  isHoliday: boolean; // true for Libur Bayar payments (amount=0, auto-PAID)

  createdAt: Date;
  updatedAt: Date;
}
