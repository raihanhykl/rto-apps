import { ISavingTransactionRepository } from '../../domain/interfaces/ISavingTransactionRepository';
import { SavingTransaction } from '../../domain/entities/SavingTransaction';
import { SavingTransactionType } from '../../domain/enums';

export class InMemorySavingTransactionRepository implements ISavingTransactionRepository {
  private data = new Map<string, SavingTransaction>();

  async findById(id: string): Promise<SavingTransaction | null> {
    return this.data.get(id) ? { ...this.data.get(id)! } : null;
  }

  async findByContractId(contractId: string): Promise<SavingTransaction[]> {
    return Array.from(this.data.values())
      .filter(tx => tx.contractId === contractId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(tx => ({ ...tx }));
  }

  async findByPaymentId(paymentId: string): Promise<SavingTransaction[]> {
    return Array.from(this.data.values())
      .filter(tx => tx.paymentId === paymentId)
      .map(tx => ({ ...tx }));
  }

  async findByContractAndType(contractId: string, type: SavingTransactionType): Promise<SavingTransaction[]> {
    return Array.from(this.data.values())
      .filter(tx => tx.contractId === contractId && tx.type === type)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(tx => ({ ...tx }));
  }

  async create(tx: SavingTransaction): Promise<SavingTransaction> {
    this.data.set(tx.id, { ...tx });
    return { ...tx };
  }

  async count(contractId: string): Promise<number> {
    return Array.from(this.data.values())
      .filter(tx => tx.contractId === contractId)
      .length;
  }
}
