import { PaymentStatus } from '../enums';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  contractId: string;
  customerId: string;
  amount: number;
  lateFee: number; // late fee amount (0 if not overdue)
  status: PaymentStatus;
  qrCodeData: string;
  dueDate: Date;
  paidAt: Date | null;
  extensionDays: number | null; // days to add to contract when paid
  createdAt: Date;
  updatedAt: Date;
}
