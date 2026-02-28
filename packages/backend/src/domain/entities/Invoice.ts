import { PaymentStatus } from '../enums';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  contractId: string;
  customerId: string;
  amount: number;
  status: PaymentStatus;
  qrCodeData: string;
  dueDate: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
