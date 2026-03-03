import { Invoice } from '../../domain/entities';
import { IInvoiceRepository } from '../../domain/interfaces';
import { PaymentStatus } from '../../domain/enums';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';

export class InMemoryInvoiceRepository implements IInvoiceRepository {
  private invoices: Map<string, Invoice> = new Map();

  async findAll(): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Invoice>> {
    let items = Array.from(this.invoices.values());
    if (params.search) { const q = params.search.toLowerCase(); items = items.filter(i => i.invoiceNumber.toLowerCase().includes(q)); }
    if (params.status && params.status !== 'ALL') { items = items.filter(i => i.status === params.status); }
    if (params.customerId) { items = items.filter(i => i.customerId === params.customerId); }
    if (params.startDate) { const s = new Date(params.startDate); items = items.filter(i => i.createdAt >= s); }
    if (params.endDate) { const e = new Date(params.endDate); e.setDate(e.getDate() + 1); items = items.filter(i => i.createdAt < e); }
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    items.sort((a, b) => { const aVal = (a as any)[sortBy]; const bVal = (b as any)[sortBy]; if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1; if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1; return 0; });
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
      .filter(i => i.contractId === contractId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByCustomerId(customerId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(i => i.customerId === customerId);
  }

  async findByStatus(status: PaymentStatus): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(i => i.status === status);
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
    return Array.from(this.invoices.values()).filter(i => i.status === status).length;
  }

  async sumByStatus(status: PaymentStatus): Promise<number> {
    return Array.from(this.invoices.values())
      .filter(i => i.status === status)
      .reduce((sum, i) => sum + i.amount + (i.lateFee || 0), 0);
  }
}
