import { PaymentStatus, InvoiceType } from '../enums';

export interface Invoice {
  id: string;
  invoiceNumber: string;
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

  // Billing period (for daily billing invoices)
  billingPeriodStart: Date | null;
  billingPeriodEnd: Date | null;
  billingId: string | null; // reference to source billing

  createdAt: Date;
  updatedAt: Date;
}
