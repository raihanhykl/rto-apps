import { PrismaClient } from '@prisma/client';
import { IServiceRecordRepository } from '../../domain/interfaces/IServiceRecordRepository';
import { ServiceRecord, DaySnapshot } from '../../domain/entities/ServiceRecord';
import { ServiceType, ServiceRecordStatus } from '../../domain/enums';

export class PrismaServiceRecordRepository implements IServiceRecordRepository {
  constructor(private prisma: PrismaClient) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toEntity(raw: any): ServiceRecord {
    return {
      id: raw.id,
      contractId: raw.contractId,
      serviceType: raw.serviceType as ServiceType,
      replacementProvided: raw.replacementProvided,
      startDate: raw.startDate,
      endDate: raw.endDate,
      compensationDays: raw.compensationDays,
      notes: raw.notes,
      attachment: raw.attachment,
      daySnapshots: raw.daySnapshots as DaySnapshot[] | null,
      status: raw.status as ServiceRecordStatus,
      revokedAt: raw.revokedAt,
      revokedBy: raw.revokedBy,
      revokeReason: raw.revokeReason,
      createdBy: raw.createdBy,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  async findById(id: string): Promise<ServiceRecord | null> {
    const raw = await this.prisma.serviceRecord.findUnique({ where: { id } });
    return raw ? this.toEntity(raw) : null;
  }

  async findByContractId(contractId: string): Promise<ServiceRecord[]> {
    const raws = await this.prisma.serviceRecord.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
    return raws.map((r) => this.toEntity(r));
  }

  async findActiveByContractId(contractId: string): Promise<ServiceRecord[]> {
    const raws = await this.prisma.serviceRecord.findMany({
      where: { contractId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    return raws.map((r) => this.toEntity(r));
  }

  async findActiveByContractAndDateRange(
    contractId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ServiceRecord[]> {
    const raws = await this.prisma.serviceRecord.findMany({
      where: {
        contractId,
        status: 'ACTIVE',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    return raws.map((r) => this.toEntity(r));
  }

  async create(record: ServiceRecord): Promise<ServiceRecord> {
    const raw = await this.prisma.serviceRecord.create({
      data: {
        id: record.id,
        contractId: record.contractId,
        serviceType: record.serviceType,
        replacementProvided: record.replacementProvided,
        startDate: record.startDate,
        endDate: record.endDate,
        compensationDays: record.compensationDays,
        notes: record.notes,
        attachment: record.attachment,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        daySnapshots: record.daySnapshots as any,
        status: record.status,
        revokedAt: record.revokedAt,
        revokedBy: record.revokedBy,
        revokeReason: record.revokeReason,
        createdBy: record.createdBy,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
    return this.toEntity(raw);
  }

  async update(id: string, data: Partial<ServiceRecord>): Promise<ServiceRecord> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.revokedAt !== undefined) updateData.revokedAt = data.revokedAt;
    if (data.revokedBy !== undefined) updateData.revokedBy = data.revokedBy;
    if (data.revokeReason !== undefined) updateData.revokeReason = data.revokeReason;
    if (data.compensationDays !== undefined) updateData.compensationDays = data.compensationDays;
    if (data.daySnapshots !== undefined) updateData.daySnapshots = data.daySnapshots as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (data.notes !== undefined) updateData.notes = data.notes;

    const raw = await this.prisma.serviceRecord.update({
      where: { id },
      data: updateData,
    });
    return this.toEntity(raw);
  }
}
