import { PaymentDayStatus } from '../enums';

export interface PaymentDay {
  id: string;
  contractId: string;
  date: Date;
  status: PaymentDayStatus;
  paymentId: string | null;
  dailyRate: number;
  amount: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
