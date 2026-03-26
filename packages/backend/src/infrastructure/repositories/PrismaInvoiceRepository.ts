import { PrismaClient, Prisma } from '@prisma/client';
import { Invoice } from '../../domain/entities';
import { IInvoiceRepository } from '../../domain/interfaces';
import { PaymentStatus, InvoiceType } from '../../domain/enums';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';

export class PrismaInvoiceRepository implements IInvoiceRepository {
  constructor(private prisma: PrismaClient) {}

  private toEntity(raw: any): Invoice {
    return {
      ...raw,
      isHoliday: raw.isHoliday ?? false,
    } as Invoice;
  }

  async findAll(): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Invoice>> {
    const where: Prisma.InvoiceWhereInput = {};

    if (params.search) {
      where.invoiceNumber = { contains: params.search, mode: 'insensitive' };
    }
    if (params.status && params.status !== 'ALL') {
      where.status = params.status as any;
    }
    if (params.customerId) {
      where.customerId = params.customerId;
    }
    if (params.invoiceType && params.invoiceType !== 'ALL') {
      where.type = params.invoiceType as any;
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
      this.prisma.invoice.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toEntity(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Invoice | null> {
    const row = await this.prisma.invoice.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByContractId(contractId: string): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByCustomerId(customerId: string): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { customerId },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByStatus(status: PaymentStatus): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { status: status as any },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findActiveByContractId(contractId: string): Promise<Invoice | null> {
    const row = await this.prisma.invoice.findFirst({
      where: {
        contractId,
        status: 'PENDING' as any,
        type: { in: ['DAILY_BILLING', 'MANUAL_PAYMENT'] as any },
      },
    });
    return row ? this.toEntity(row) : null;
  }

  async findAllPendingByContractId(contractId: string): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        contractId,
        status: 'PENDING' as any,
        type: { in: ['DAILY_BILLING', 'MANUAL_PAYMENT'] as any },
      },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async search(query: string): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        invoiceNumber: { contains: query, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((r) => this.toEntity(r));
  }

  async create(invoice: Invoice): Promise<Invoice> {
    const row = await this.prisma.invoice.create({
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        contractId: invoice.contractId,
        customerId: invoice.customerId,
        amount: invoice.amount,
        lateFee: invoice.lateFee,
        type: invoice.type as any,
        status: invoice.status as any,
        qrCodeData: invoice.qrCodeData,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        extensionDays: invoice.extensionDays,
        dokuPaymentUrl: invoice.dokuPaymentUrl,
        dokuReferenceId: invoice.dokuReferenceId,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        dailyRate: invoice.dailyRate,
        daysCount: invoice.daysCount,
        expiredAt: invoice.expiredAt,
        previousPaymentId: invoice.previousPaymentId,
        isHoliday: invoice.isHoliday,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, data: Partial<Invoice>): Promise<Invoice | null> {
    try {
      const { id: _id, ...updateData } = data as any;
      const row = await this.prisma.invoice.update({
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
      await this.prisma.invoice.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async count(): Promise<number> {
    return this.prisma.invoice.count();
  }

  async countByStatus(status: PaymentStatus): Promise<number> {
    return this.prisma.invoice.count({ where: { status: status as any } });
  }

  async sumByStatus(status: PaymentStatus): Promise<number> {
    const result = await this.prisma.invoice.aggregate({
      where: { status: status as any },
      _sum: {
        amount: true,
        lateFee: true,
      },
    });
    return (result._sum.amount || 0) + (result._sum.lateFee || 0);
  }

  async findMaxInvoiceSequence(): Promise<number> {
    const invoices = await this.prisma.invoice.findMany({
      select: { invoiceNumber: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    let max = 0;
    for (const i of invoices) {
      const match = i.invoiceNumber.match(/PMT-\d{6}-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return max;
  }
}
