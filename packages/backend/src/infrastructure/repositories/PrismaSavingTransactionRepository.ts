import { PrismaClient, Prisma, $Enums } from '@prisma/client';
import { ISavingTransactionRepository } from '../../domain/interfaces/ISavingTransactionRepository';
import { SavingTransaction } from '../../domain/entities/SavingTransaction';
import { SavingTransactionType } from '../../domain/enums';

type PrismaSavingTx = Prisma.SavingTransactionGetPayload<object>;

export class PrismaSavingTransactionRepository implements ISavingTransactionRepository {
  constructor(private prisma: PrismaClient) {}

  private toEntity(raw: PrismaSavingTx): SavingTransaction {
    return {
      ...raw,
      type: raw.type as unknown as SavingTransactionType,
    };
  }

  async findById(id: string): Promise<SavingTransaction | null> {
    const raw = await this.prisma.savingTransaction.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async findByContractId(contractId: string): Promise<SavingTransaction[]> {
    const raws = await this.prisma.savingTransaction.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
    return raws.map((r) => this.toEntity(r));
  }

  async findByPaymentId(paymentId: string): Promise<SavingTransaction[]> {
    const raws = await this.prisma.savingTransaction.findMany({
      where: { paymentId },
    });
    return raws.map((r) => this.toEntity(r));
  }

  async findByContractAndType(
    contractId: string,
    type: SavingTransactionType,
  ): Promise<SavingTransaction[]> {
    const raws = await this.prisma.savingTransaction.findMany({
      where: { contractId, type: type as string as $Enums.SavingTransactionType },
      orderBy: { createdAt: 'desc' },
    });
    return raws.map((r) => this.toEntity(r));
  }

  async create(tx: SavingTransaction): Promise<SavingTransaction> {
    const raw = await this.prisma.savingTransaction.create({
      data: {
        id: tx.id,
        contractId: tx.contractId,
        type: tx.type as string as $Enums.SavingTransactionType,
        amount: tx.amount,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
        paymentId: tx.paymentId,
        daysCount: tx.daysCount,
        description: tx.description,
        photo: tx.photo,
        partsReplaced: tx.partsReplaced,
        partsRepaired: tx.partsRepaired,
        createdBy: tx.createdBy,
        notes: tx.notes,
      },
    });
    return this.toEntity(raw);
  }

  async count(contractId: string): Promise<number> {
    return this.prisma.savingTransaction.count({ where: { contractId } });
  }

  async findPaginatedByContractId(
    contractId: string,
    page: number,
    limit: number,
  ): Promise<{ data: SavingTransaction[]; total: number }> {
    const where = { contractId };
    const [rows, total] = await Promise.all([
      this.prisma.savingTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.savingTransaction.count({ where }),
    ]);
    return { data: rows.map((r) => this.toEntity(r)), total };
  }
}
