import { Customer } from '../../domain/entities';
import { ICustomerRepository } from '../../domain/interfaces';

export class InMemoryCustomerRepository implements ICustomerRepository {
  private customers: Map<string, Customer> = new Map();

  async findAll(): Promise<Customer[]> {
    return Array.from(this.customers.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async findById(id: string): Promise<Customer | null> {
    return this.customers.get(id) || null;
  }

  async findByKtpNumber(ktpNumber: string): Promise<Customer | null> {
    return Array.from(this.customers.values()).find(c => c.ktpNumber === ktpNumber) || null;
  }

  async search(query: string): Promise<Customer[]> {
    const q = query.toLowerCase();
    return Array.from(this.customers.values()).filter(
      c =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.ktpNumber.includes(q)
    );
  }

  async create(customer: Customer): Promise<Customer> {
    this.customers.set(customer.id, { ...customer });
    return { ...customer };
  }

  async update(id: string, data: Partial<Customer>): Promise<Customer | null> {
    const existing = this.customers.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.customers.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.customers.delete(id);
  }

  async count(): Promise<number> {
    return this.customers.size;
  }
}
