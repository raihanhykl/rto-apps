import { SavingTransactionType } from '../enums';

export interface SavingTransaction {
  id: string;
  contractId: string;
  type: SavingTransactionType;
  amount: number; // Selalu positif
  balanceBefore: number;
  balanceAfter: number;
  paymentId: string | null;
  daysCount: number | null;
  description: string | null;
  photo: string | null;
  partsReplaced: string | null;
  partsRepaired: string | null;
  createdBy: string;
  notes: string | null;
  createdAt: Date;
}
