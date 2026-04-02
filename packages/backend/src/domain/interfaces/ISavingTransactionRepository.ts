import { SavingTransaction } from '../entities/SavingTransaction';
import { SavingTransactionType } from '../enums';

export interface ISavingTransactionRepository {
  findById(id: string): Promise<SavingTransaction | null>;
  findByContractId(contractId: string): Promise<SavingTransaction[]>; // ordered by createdAt DESC
  findByPaymentId(paymentId: string): Promise<SavingTransaction[]>;
  findByServiceRecordId(serviceRecordId: string): Promise<SavingTransaction | null>;
  findByContractAndType(
    contractId: string,
    type: SavingTransactionType,
  ): Promise<SavingTransaction[]>;
  create(tx: SavingTransaction): Promise<SavingTransaction>;
  count(contractId: string): Promise<number>;
  findPaginatedByContractId(
    contractId: string,
    page: number,
    limit: number,
  ): Promise<{ data: SavingTransaction[]; total: number }>;
}
