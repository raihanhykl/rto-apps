import { PrismaClient, Prisma, $Enums } from '@prisma/client';
import { AuditLog } from '../../domain/entities';
import { AuditAction } from '../../domain/enums';
import { IAuditLogRepository } from '../../domain/interfaces';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';

export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<AuditLog[]> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<AuditLog>> {
    const where: Prisma.AuditLogWhereInput = {};

    if (params.search) {
      where.OR = [
        { description: { contains: params.search, mode: 'insensitive' } },
        { action: { equals: params.search as string as $Enums.AuditAction } },
      ];
    }
    if (params.module) {
      where.module = params.module;
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
      this.prisma.auditLog.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toEntity(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByModule(module: string): Promise<AuditLog[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { module },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findRecent(limit: number): Promise<AuditLog[]> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => this.toEntity(r));
  }

  async create(log: AuditLog): Promise<AuditLog> {
    const row = await this.prisma.auditLog.create({
      data: {
        id: log.id,
        userId: log.userId,
        action: log.action,
        module: log.module,
        entityId: log.entityId,
        description: log.description,
        metadata: log.metadata as Prisma.InputJsonValue,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      },
    });
    return this.toEntity(row);
  }

  async count(): Promise<number> {
    return this.prisma.auditLog.count();
  }

  private toEntity(raw: Prisma.AuditLogGetPayload<object>): AuditLog {
    return {
      id: raw.id,
      userId: raw.userId,
      action: raw.action as unknown as AuditAction,
      module: raw.module,
      entityId: raw.entityId,
      description: raw.description,
      metadata: (raw.metadata as Record<string, unknown>) || {},
      ipAddress: raw.ipAddress,
      createdAt: raw.createdAt,
    };
  }
}
