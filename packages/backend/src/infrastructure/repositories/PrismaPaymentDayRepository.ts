import { PrismaClient } from '@prisma/client';
import { PaymentDay } from '../../domain/entities';
import { IPaymentDayRepository } from '../../domain/interfaces';
import { PaymentDayStatus } from '../../domain/enums';

export class PrismaPaymentDayRepository implements IPaymentDayRepository {
  constructor(private prisma: PrismaClient) {}

  private toEntity(raw: any): PaymentDay {
    return {
      ...raw,
      status: raw.status as PaymentDayStatus,
    };
  }

  async findById(id: string): Promise<PaymentDay | null> {
    const row = await this.prisma.paymentDay.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByContractId(contractId: string): Promise<PaymentDay[]> {
    const rows = await this.prisma.paymentDay.findMany({
      where: { contractId },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByContractAndDateRange(
    contractId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentDay[]> {
    const rows = await this.prisma.paymentDay.findMany({
      where: {
        contractId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByPaymentId(paymentId: string): Promise<PaymentDay[]> {
    const rows = await this.prisma.paymentDay.findMany({
      where: { paymentId },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByContractAndDate(contractId: string, date: Date): Promise<PaymentDay | null> {
    // Use ±12h range to handle timezone offset between WIB and UTC.
    // A WIB-midnight date is stored as 17:00 UTC previous day, while
    // UTC-midnight is 00:00 UTC same day. ±12h covers both without
    // matching adjacent calendar days.
    const rangeStart = new Date(date.getTime() - 12 * 60 * 60 * 1000);
    const rangeEnd = new Date(date.getTime() + 12 * 60 * 60 * 1000);

    const row = await this.prisma.paymentDay.findFirst({
      where: {
        contractId,
        date: { gte: rangeStart, lt: rangeEnd },
      },
    });
    return row ? this.toEntity(row) : null;
  }

  async findByContractAndStatus(
    contractId: string,
    status: PaymentDayStatus,
  ): Promise<PaymentDay[]> {
    const rows = await this.prisma.paymentDay.findMany({
      where: { contractId, status: status as any },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async create(paymentDay: PaymentDay): Promise<PaymentDay> {
    const row = await this.prisma.paymentDay.create({
      data: {
        id: paymentDay.id,
        contractId: paymentDay.contractId,
        date: paymentDay.date,
        status: paymentDay.status as any,
        paymentId: paymentDay.paymentId,
        dailyRate: paymentDay.dailyRate,
        amount: paymentDay.amount,
        notes: paymentDay.notes,
        createdAt: paymentDay.createdAt,
      },
    });
    return this.toEntity(row);
  }

  async createMany(paymentDays: PaymentDay[]): Promise<number> {
    const result = await this.prisma.paymentDay.createMany({
      data: paymentDays.map((pd) => ({
        id: pd.id,
        contractId: pd.contractId,
        date: pd.date,
        status: pd.status as any,
        paymentId: pd.paymentId,
        dailyRate: pd.dailyRate,
        amount: pd.amount,
        notes: pd.notes,
        createdAt: pd.createdAt,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async update(id: string, data: Partial<PaymentDay>): Promise<PaymentDay | null> {
    try {
      const { id: _id, ...updateData } = data as any;
      const row = await this.prisma.paymentDay.update({
        where: { id },
        data: updateData,
      });
      return this.toEntity(row);
    } catch {
      return null;
    }
  }

  async updateByContractAndDate(
    contractId: string,
    date: Date,
    data: Partial<PaymentDay>,
  ): Promise<PaymentDay | null> {
    try {
      // Use timezone-safe findByContractAndDate, then update by id
      const existing = await this.findByContractAndDate(contractId, date);
      if (!existing) return null;

      const { id: _id, ...updateData } = data as any;
      const row = await this.prisma.paymentDay.update({
        where: { id: existing.id },
        data: updateData,
      });
      return this.toEntity(row);
    } catch {
      return null;
    }
  }

  async updateManyByPaymentId(paymentId: string, data: Partial<PaymentDay>): Promise<number> {
    const { id: _id, ...updateData } = data as any;
    const result = await this.prisma.paymentDay.updateMany({
      where: { paymentId },
      data: updateData,
    });
    return result.count;
  }

  async countByContractAndStatus(contractId: string, status: PaymentDayStatus): Promise<number> {
    return this.prisma.paymentDay.count({
      where: { contractId, status: status as any },
    });
  }

  async countByContractAndStatuses(
    contractId: string,
    statuses: PaymentDayStatus[],
  ): Promise<number> {
    return this.prisma.paymentDay.count({
      where: {
        contractId,
        status: { in: statuses.map((s) => s as any) },
      },
    });
  }

  async findLastPaidOrHolidayDate(contractId: string): Promise<Date | null> {
    const result = await this.prisma.paymentDay.findFirst({
      where: {
        contractId,
        status: { in: ['PAID', 'HOLIDAY'] as any },
      },
      orderBy: { date: 'desc' },
    });
    return result?.date ?? null;
  }
}
