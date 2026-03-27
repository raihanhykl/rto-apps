import { Invoice } from '../../domain/entities';
import { IInvoiceRepository } from '../../domain/interfaces';
import { PaymentStatus, InvoiceType } from '../../domain/enums';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';
import { getWibParts, getWibToday } from '../../domain/utils/dateUtils';

export class InMemoryInvoiceRepository implements IInvoiceRepository {
  private invoices: Map<string, Invoice> = new Map();

  async findAll(): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Invoice>> {
    let items = Array.from(this.invoices.values());
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter((i) => i.invoiceNumber.toLowerCase().includes(q));
    }
    if (params.status && params.status !== 'ALL') {
      items = items.filter((i) => i.status === params.status);
    }
    if (params.customerId) {
      items = items.filter((i) => i.customerId === params.customerId);
    }
    if (params.invoiceType && params.invoiceType !== 'ALL') {
      items = items.filter((i) => i.type === params.invoiceType);
    }
    if (params.startDate) {
      const s = new Date(params.startDate);
      items = items.filter((i) => i.createdAt >= s);
    }
    if (params.endDate) {
      const e = new Date(params.endDate);
      e.setDate(e.getDate() + 1);
      items = items.filter((i) => i.createdAt < e);
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

  async findById(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) || null;
  }

  async findByContractId(contractId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values())
      .filter((i) => i.contractId === contractId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByContractIds(contractIds: string[]): Promise<Invoice[]> {
    const idSet = new Set(contractIds);
    return Array.from(this.invoices.values())
      .filter((i) => idSet.has(i.contractId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findActiveByContractIds(contractIds: string[]): Promise<Map<string, Invoice>> {
    const result = new Map<string, Invoice>();
    const idSet = new Set(contractIds);
    for (const inv of this.invoices.values()) {
      if (
        idSet.has(inv.contractId) &&
        inv.status === PaymentStatus.PENDING &&
        (inv.type === InvoiceType.DAILY_BILLING || inv.type === InvoiceType.MANUAL_PAYMENT) &&
        !result.has(inv.contractId)
      ) {
        result.set(inv.contractId, inv);
      }
    }
    return result;
  }

  async findByCustomerId(customerId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter((i) => i.customerId === customerId);
  }

  async findByStatus(status: PaymentStatus): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter((i) => i.status === status);
  }

  async findActiveByContractId(contractId: string): Promise<Invoice | null> {
    const active = Array.from(this.invoices.values()).find(
      (i) =>
        i.contractId === contractId &&
        i.status === PaymentStatus.PENDING &&
        (i.type === InvoiceType.DAILY_BILLING || i.type === InvoiceType.MANUAL_PAYMENT),
    );
    return active || null;
  }

  async findAllPendingByContractId(contractId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(
      (i) =>
        i.contractId === contractId &&
        i.status === PaymentStatus.PENDING &&
        (i.type === InvoiceType.DAILY_BILLING || i.type === InvoiceType.MANUAL_PAYMENT),
    );
  }

  async search(query: string): Promise<Invoice[]> {
    const q = query.toLowerCase();
    return Array.from(this.invoices.values())
      .filter((i) => i.invoiceNumber.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);
  }

  async create(invoice: Invoice): Promise<Invoice> {
    this.invoices.set(invoice.id, { ...invoice });
    return { ...invoice };
  }

  async update(id: string, data: Partial<Invoice>): Promise<Invoice | null> {
    const existing = this.invoices.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.invoices.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.invoices.delete(id);
  }

  async count(): Promise<number> {
    return this.invoices.size;
  }

  async countByStatus(status: PaymentStatus): Promise<number> {
    return Array.from(this.invoices.values()).filter((i) => i.status === status).length;
  }

  async sumByStatus(status: PaymentStatus): Promise<number> {
    return Array.from(this.invoices.values())
      .filter((i) => i.status === status)
      .reduce((sum, i) => sum + i.amount + (i.lateFee || 0), 0);
  }

  async findMaxInvoiceSequence(): Promise<number> {
    let max = 0;
    for (const i of this.invoices.values()) {
      const match = i.invoiceNumber.match(/PMT-\d{6}-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return max;
  }

  async getRevenueByMonth(months: number): Promise<Array<{ month: string; revenue: number }>> {
    const nowParts = getWibParts(getWibToday());
    const result: Array<{ month: string; revenue: number }> = [];

    const paidInvoices = Array.from(this.invoices.values()).filter(
      (inv) => inv.status === PaymentStatus.PAID,
    );

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(nowParts.year, nowParts.month - 1 - i, 1);
      const wibD = getWibParts(d);
      const monthKey = `${wibD.year}-${String(wibD.month).padStart(2, '0')}`;

      const revenue = paidInvoices
        .filter((inv) => {
          if (!inv.paidAt) return false;
          const pd = inv.paidAt instanceof Date ? inv.paidAt : new Date(inv.paidAt);
          const wibPd = getWibParts(pd);
          return `${wibPd.year}-${String(wibPd.month).padStart(2, '0')}` === monthKey;
        })
        .reduce((sum, inv) => sum + inv.amount + (inv.lateFee || 0), 0);

      result.push({ month: monthKey, revenue });
    }
    return result;
  }

  async findByDateRange(
    startDate?: Date,
    endDate?: Date,
    contractIds?: string[],
  ): Promise<Invoice[]> {
    let items = Array.from(this.invoices.values());

    if (startDate) {
      items = items.filter((i) => i.createdAt >= startDate);
    }
    if (endDate) {
      items = items.filter((i) => i.createdAt <= endDate);
    }
    if (contractIds && contractIds.length > 0) {
      const idSet = new Set(contractIds);
      items = items.filter((i) => idSet.has(i.contractId));
    }

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findPaginatedByContractId(
    contractId: string,
    page: number,
    limit: number,
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<{ data: Invoice[]; total: number }> {
    const filtered = Array.from(this.invoices.values())
      .filter((inv) => inv.contractId === contractId)
      .sort((a, b) =>
        sortOrder === 'desc'
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime(),
      );
    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);
    return { data, total };
  }
}
