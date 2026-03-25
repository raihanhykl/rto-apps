import { PrismaClient, Prisma } from '@prisma/client';
import { Contract } from '../../domain/entities';
import { IContractRepository } from '../../domain/interfaces';
import { ContractStatus } from '../../domain/enums';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';

export class PrismaContractRepository implements IContractRepository {
  constructor(private prisma: PrismaClient) {}

  private toEntity(raw: any): Contract {
    return raw as Contract;
  }

  // Note: findAll does NOT filter isDeleted (matches InMemory behavior)
  async findAll(): Promise<Contract[]> {
    const rows = await this.prisma.contract.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Contract>> {
    const where: Prisma.ContractWhereInput = { isDeleted: false };

    if (params.search) {
      where.OR = [
        { contractNumber: { contains: params.search, mode: 'insensitive' } },
        { motorModel: { equals: params.search.toUpperCase() as any } },
      ];
    }
    if (params.status && params.status !== 'ALL') {
      where.status = params.status as any;
    }
    if (params.motorModel && params.motorModel !== 'ALL') {
      where.motorModel = params.motorModel as any;
    }
    if (params.batteryType && params.batteryType !== 'ALL') {
      where.batteryType = params.batteryType as any;
    }
    if (params.dpScheme && params.dpScheme !== 'ALL') {
      where.dpScheme = params.dpScheme as any;
    }
    if (params.dpFullyPaid && params.dpFullyPaid !== 'ALL') {
      where.dpFullyPaid = params.dpFullyPaid === 'true';
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
      this.prisma.contract.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contract.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toEntity(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Contract | null> {
    const row = await this.prisma.contract.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByCustomerId(customerId: string): Promise<Contract[]> {
    const rows = await this.prisma.contract.findMany({
      where: { customerId, isDeleted: false },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByStatus(status: ContractStatus): Promise<Contract[]> {
    const rows = await this.prisma.contract.findMany({
      where: { status: status as any, isDeleted: false },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async create(contract: Contract): Promise<Contract> {
    const row = await this.prisma.contract.create({
      data: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        customerId: contract.customerId,
        motorModel: contract.motorModel as any,
        batteryType: contract.batteryType as any,
        dailyRate: contract.dailyRate,
        durationDays: contract.durationDays,
        totalAmount: contract.totalAmount,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status as any,
        notes: contract.notes,
        createdBy: contract.createdBy,
        color: contract.color,
        year: contract.year,
        vinNumber: contract.vinNumber,
        engineNumber: contract.engineNumber,
        dpAmount: contract.dpAmount,
        dpScheme: contract.dpScheme as any,
        dpPaidAmount: contract.dpPaidAmount,
        dpFullyPaid: contract.dpFullyPaid,
        unitReceivedDate: contract.unitReceivedDate,
        billingStartDate: contract.billingStartDate,
        bastPhoto: contract.bastPhoto,
        bastNotes: contract.bastNotes,
        holidayScheme: contract.holidayScheme as any,
        ownershipTargetDays: contract.ownershipTargetDays,
        totalDaysPaid: contract.totalDaysPaid,
        workingDaysPaid: contract.workingDaysPaid,
        holidayDaysPaid: contract.holidayDaysPaid,
        ownershipProgress: contract.ownershipProgress,
        gracePeriodDays: contract.gracePeriodDays,
        repossessedAt: contract.repossessedAt,
        completedAt: contract.completedAt,
        isDeleted: contract.isDeleted,
        deletedAt: contract.deletedAt,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, data: Partial<Contract>): Promise<Contract | null> {
    try {
      const { id: _id, customerId: _cid, ...updateData } = data as any;
      const row = await this.prisma.contract.update({
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
      await this.prisma.contract.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async count(): Promise<number> {
    return this.prisma.contract.count({ where: { isDeleted: false } });
  }

  async countByStatus(status: ContractStatus): Promise<number> {
    return this.prisma.contract.count({
      where: { status: status as any, isDeleted: false },
    });
  }

  async findMaxContractSequence(): Promise<number> {
    const contracts = await this.prisma.contract.findMany({
      select: { contractNumber: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    let max = 0;
    for (const c of contracts) {
      // Parse NN/WNUS-KTR/I/YYYY format
      const match = c.contractNumber.match(/^(\d+)\//);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return max;
  }

  async updateGracePeriodByStatuses(
    gracePeriodDays: number,
    statuses: ContractStatus[],
  ): Promise<number> {
    const result = await this.prisma.contract.updateMany({
      where: {
        status: { in: statuses as any },
        isDeleted: false,
      },
      data: { gracePeriodDays },
    });
    return result.count;
  }
}
