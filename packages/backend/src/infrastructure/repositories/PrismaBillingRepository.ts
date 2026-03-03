import { PrismaClient, Prisma } from '@prisma/client';
import { Billing } from '../../domain/entities';
import { IBillingRepository } from '../../domain/interfaces';
import { BillingStatus } from '../../domain/enums';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';

export class PrismaBillingRepository implements IBillingRepository {
  constructor(private prisma: PrismaClient) {}

  private toEntity(raw: any): Billing {
    return raw as Billing;
  }

  async findAll(): Promise<Billing[]> {
    const rows = await this.prisma.billing.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(r => this.toEntity(r));
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Billing>> {
    const where: Prisma.BillingWhereInput = { isDeleted: false };

    if (params.search) {
      where.billingNumber = { contains: params.search, mode: 'insensitive' };
    }
    if (params.status && params.status !== 'ALL') {
      where.status = params.status as any;
    }
    if (params.customerId) {
      where.customerId = params.customerId;
    }
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(params.startDate);
      }
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setDate(end.getDate() + 1);
        (where.createdAt as Prisma.DateTimeFilter).lt = end;
      }
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.billing.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.billing.count({ where }),
    ]);

    return {
      data: rows.map(r => this.toEntity(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Billing | null> {
    const row = await this.prisma.billing.findFirst({
      where: { id, isDeleted: false },
    });
    return row ? this.toEntity(row) : null;
  }

  async findByContractId(contractId: string): Promise<Billing[]> {
    const rows = await this.prisma.billing.findMany({
      where: { contractId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(r => this.toEntity(r));
  }

  async findByCustomerId(customerId: string): Promise<Billing[]> {
    const rows = await this.prisma.billing.findMany({
      where: { customerId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(r => this.toEntity(r));
  }

  async findByStatus(status: BillingStatus): Promise<Billing[]> {
    const rows = await this.prisma.billing.findMany({
      where: { status: status as any, isDeleted: false },
    });
    return rows.map(r => this.toEntity(r));
  }

  async findActiveByContractId(contractId: string): Promise<Billing | null> {
    const row = await this.prisma.billing.findFirst({
      where: { contractId, status: 'ACTIVE' as any, isDeleted: false },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(billing: Billing): Promise<Billing> {
    const row = await this.prisma.billing.create({
      data: {
        id: billing.id,
        billingNumber: billing.billingNumber,
        contractId: billing.contractId,
        customerId: billing.customerId,
        amount: billing.amount,
        dailyRate: billing.dailyRate,
        daysCount: billing.daysCount,
        status: billing.status as any,
        dokuPaymentUrl: billing.dokuPaymentUrl,
        dokuReferenceId: billing.dokuReferenceId,
        periodStart: billing.periodStart,
        periodEnd: billing.periodEnd,
        expiredAt: billing.expiredAt,
        paidAt: billing.paidAt,
        invoiceId: billing.invoiceId,
        previousBillingId: billing.previousBillingId,
        isDeleted: billing.isDeleted,
        deletedAt: billing.deletedAt,
        createdAt: billing.createdAt,
        updatedAt: billing.updatedAt,
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, data: Partial<Billing>): Promise<Billing | null> {
    try {
      const { id: _id, ...updateData } = data as any;
      const row = await this.prisma.billing.update({
        where: { id },
        data: updateData,
      });
      return this.toEntity(row);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.billing.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async count(): Promise<number> {
    return this.prisma.billing.count({ where: { isDeleted: false } });
  }

  async countByStatus(status: BillingStatus): Promise<number> {
    return this.prisma.billing.count({
      where: { status: status as any, isDeleted: false },
    });
  }
}
