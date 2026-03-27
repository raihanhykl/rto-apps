import { Contract } from '../../domain/entities';
import { IContractRepository } from '../../domain/interfaces';
import { ContractStatus } from '../../domain/enums';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';

export class InMemoryContractRepository implements IContractRepository {
  private contracts: Map<string, Contract> = new Map();

  async findAll(): Promise<Contract[]> {
    return Array.from(this.contracts.values())
      .filter((c) => !c.isDeleted)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Contract>> {
    let items = Array.from(this.contracts.values()).filter((c) => !c.isDeleted);
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (c) => c.contractNumber.toLowerCase().includes(q) || c.motorModel.toLowerCase().includes(q),
      );
    }
    if (params.status && params.status !== 'ALL') {
      items = items.filter((c) => c.status === params.status);
    }
    if (params.motorModel && params.motorModel !== 'ALL') {
      items = items.filter((c) => c.motorModel === params.motorModel);
    }
    if (params.batteryType && params.batteryType !== 'ALL') {
      items = items.filter((c) => c.batteryType === params.batteryType);
    }
    if (params.dpScheme && params.dpScheme !== 'ALL') {
      items = items.filter((c) => c.dpScheme === params.dpScheme);
    }
    if (params.dpFullyPaid && params.dpFullyPaid !== 'ALL') {
      items = items.filter((c) => c.dpFullyPaid === (params.dpFullyPaid === 'true'));
    }
    if (params.startDate) {
      const s = new Date(params.startDate);
      items = items.filter((c) => c.createdAt >= s);
    }
    if (params.endDate) {
      const e = new Date(params.endDate);
      e.setDate(e.getDate() + 1);
      items = items.filter((c) => c.createdAt < e);
    }
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    items.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    const total = items.length;
    const page = params.page || 1;
    const limit = params.limit || 20;
    const startIdx = (page - 1) * limit;
    const data = items.slice(startIdx, startIdx + limit);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<Contract | null> {
    return this.contracts.get(id) || null;
  }

  async findByIds(ids: string[]): Promise<Contract[]> {
    const idSet = new Set(ids);
    return Array.from(this.contracts.values()).filter((c) => idSet.has(c.id));
  }

  async findByCustomerId(customerId: string): Promise<Contract[]> {
    return Array.from(this.contracts.values()).filter(
      (c) => c.customerId === customerId && !c.isDeleted,
    );
  }

  async findByStatus(status: ContractStatus): Promise<Contract[]> {
    return Array.from(this.contracts.values()).filter((c) => c.status === status && !c.isDeleted);
  }

  async create(contract: Contract): Promise<Contract> {
    this.contracts.set(contract.id, { ...contract });
    return { ...contract };
  }

  async update(id: string, data: Partial<Contract>): Promise<Contract | null> {
    const existing = this.contracts.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.contracts.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.contracts.delete(id);
  }

  async count(): Promise<number> {
    return Array.from(this.contracts.values()).filter((c) => !c.isDeleted).length;
  }

  async countByStatus(status: ContractStatus): Promise<number> {
    return Array.from(this.contracts.values()).filter((c) => c.status === status && !c.isDeleted)
      .length;
  }

  async findMaxContractSequence(): Promise<number> {
    let max = 0;
    for (const c of this.contracts.values()) {
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
    let count = 0;
    for (const contract of this.contracts.values()) {
      if (!contract.isDeleted && statuses.includes(contract.status)) {
        contract.gracePeriodDays = gracePeriodDays;
        contract.updatedAt = new Date();
        count++;
      }
    }
    return count;
  }

  async atomicDecrementSavingBalance(contractId: string, amount: number): Promise<Contract | null> {
    const contract = this.contracts.get(contractId);
    if (!contract) return null;
    if (contract.savingBalance < amount) return null;
    contract.savingBalance -= amount;
    contract.updatedAt = new Date();
    return { ...contract };
  }

  async findFiltered(filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: ContractStatus;
    motorModel?: string;
    batteryType?: string;
  }): Promise<Contract[]> {
    let items = Array.from(this.contracts.values()).filter((c) => !c.isDeleted);

    if (filters?.startDate) {
      items = items.filter((c) => c.createdAt >= filters.startDate!);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      items = items.filter((c) => c.createdAt <= end);
    }
    if (filters?.status) {
      items = items.filter((c) => c.status === filters.status);
    }
    if (filters?.motorModel) {
      items = items.filter((c) => c.motorModel === filters.motorModel);
    }
    if (filters?.batteryType) {
      items = items.filter((c) => c.batteryType === filters.batteryType);
    }

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
