import { IServiceRecordRepository } from '../../domain/interfaces/IServiceRecordRepository';
import { ServiceRecord } from '../../domain/entities/ServiceRecord';
import { ServiceRecordStatus } from '../../domain/enums';

export class InMemoryServiceRecordRepository implements IServiceRecordRepository {
  private data = new Map<string, ServiceRecord>();

  async findById(id: string): Promise<ServiceRecord | null> {
    const record = this.data.get(id);
    return record ? { ...record } : null;
  }

  async findByContractId(contractId: string): Promise<ServiceRecord[]> {
    return Array.from(this.data.values())
      .filter((r) => r.contractId === contractId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => ({ ...r }));
  }

  async findActiveByContractId(contractId: string): Promise<ServiceRecord[]> {
    return Array.from(this.data.values())
      .filter((r) => r.contractId === contractId && r.status === ServiceRecordStatus.ACTIVE)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => ({ ...r }));
  }

  async findActiveByContractAndDateRange(
    contractId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ServiceRecord[]> {
    return Array.from(this.data.values())
      .filter((r) => {
        if (r.contractId !== contractId) return false;
        if (r.status !== ServiceRecordStatus.ACTIVE) return false;
        // Check overlap: record.start <= endDate AND record.end >= startDate
        return r.startDate <= endDate && r.endDate >= startDate;
      })
      .map((r) => ({ ...r }));
  }

  async create(record: ServiceRecord): Promise<ServiceRecord> {
    this.data.set(record.id, { ...record });
    return { ...record };
  }

  async update(id: string, data: Partial<ServiceRecord>): Promise<ServiceRecord> {
    const existing = this.data.get(id);
    if (!existing) throw new Error(`ServiceRecord ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.data.set(id, updated);
    return { ...updated };
  }
}
