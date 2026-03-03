import { Billing } from '../../domain/entities';
import { IBillingRepository } from '../../domain/interfaces';
import { BillingStatus } from '../../domain/enums';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';

export class InMemoryBillingRepository implements IBillingRepository {
  private billings: Map<string, Billing> = new Map();

  async findAll(): Promise<Billing[]> {
    return Array.from(this.billings.values())
      .filter(b => !b.isDeleted)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Billing>> {
    let items = Array.from(this.billings.values()).filter(b => !b.isDeleted);

    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(b => b.billingNumber.toLowerCase().includes(q));
    }
    if (params.status && params.status !== 'ALL') {
      items = items.filter(b => b.status === params.status);
    }
    if (params.customerId) {
      items = items.filter(b => b.customerId === params.customerId);
    }
    if (params.startDate) {
      const s = new Date(params.startDate);
      items = items.filter(b => b.createdAt >= s);
    }
    if (params.endDate) {
      const e = new Date(params.endDate);
      e.setDate(e.getDate() + 1);
      items = items.filter(b => b.createdAt < e);
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

  async findById(id: string): Promise<Billing | null> {
    const billing = this.billings.get(id);
    if (!billing || billing.isDeleted) return null;
    return { ...billing };
  }

  async findByContractId(contractId: string): Promise<Billing[]> {
    return Array.from(this.billings.values())
      .filter(b => b.contractId === contractId && !b.isDeleted)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByCustomerId(customerId: string): Promise<Billing[]> {
    return Array.from(this.billings.values())
      .filter(b => b.customerId === customerId && !b.isDeleted)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByStatus(status: BillingStatus): Promise<Billing[]> {
    return Array.from(this.billings.values())
      .filter(b => b.status === status && !b.isDeleted);
  }

  async findActiveByContractId(contractId: string): Promise<Billing | null> {
    const active = Array.from(this.billings.values())
      .find(b => b.contractId === contractId && b.status === BillingStatus.ACTIVE && !b.isDeleted);
    return active ? { ...active } : null;
  }

  async create(billing: Billing): Promise<Billing> {
    this.billings.set(billing.id, { ...billing });
    return { ...billing };
  }

  async update(id: string, data: Partial<Billing>): Promise<Billing | null> {
    const existing = this.billings.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.billings.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.billings.delete(id);
  }

  async count(): Promise<number> {
    return Array.from(this.billings.values()).filter(b => !b.isDeleted).length;
  }

  async countByStatus(status: BillingStatus): Promise<number> {
    return Array.from(this.billings.values())
      .filter(b => b.status === status && !b.isDeleted).length;
  }
}
