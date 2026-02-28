import { Invoice } from '../../domain/entities';
import { IInvoiceRepository } from '../../domain/interfaces';
import { PaymentStatus } from '../../domain/enums';

export class InMemoryInvoiceRepository implements IInvoiceRepository {
  private invoices: Map<string, Invoice> = new Map();

  async findAll(): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async findById(id: string): Promise<Invoice | null> {
    return this.invoices.get(id) || null;
  }

  async findByContractId(contractId: string): Promise<Invoice | null> {
    return Array.from(this.invoices.values()).find(i => i.contractId === contractId) || null;
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
      .reduce((sum, i) => sum + i.amount, 0);
  }
}
