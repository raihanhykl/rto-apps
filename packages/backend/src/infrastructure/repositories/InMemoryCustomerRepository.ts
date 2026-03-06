import { Customer } from '../../domain/entities';
import { ICustomerRepository } from '../../domain/interfaces';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';

export class InMemoryCustomerRepository implements ICustomerRepository {
  private customers: Map<string, Customer> = new Map();

  async findAll(): Promise<Customer[]> {
    return Array.from(this.customers.values())
      .filter(c => !c.isDeleted)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Customer>> {
    let items = Array.from(this.customers.values()).filter(c => !c.isDeleted);
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(c => c.fullName.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q) || c.ktpNumber.includes(q));
    }
    if (params.gender && params.gender !== 'ALL') { items = items.filter(c => c.gender === params.gender); }
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    items.sort((a, b) => { const aVal = (a as any)[sortBy]; const bVal = (b as any)[sortBy]; if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1; if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1; return 0; });
    const total = items.length;
    const page = params.page || 1;
    const limit = params.limit || 20;
    const start = (page - 1) * limit;
    const data = items.slice(start, start + limit);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<Customer | null> {
    const customer = this.customers.get(id) || null;
    return customer;
  }

  async findByKtpNumber(ktpNumber: string): Promise<Customer | null> {
    return Array.from(this.customers.values())
      .find(c => c.ktpNumber === ktpNumber && !c.isDeleted) || null;
  }

  async search(query: string): Promise<Customer[]> {
    const q = query.toLowerCase();
    return Array.from(this.customers.values()).filter(
      c =>
        !c.isDeleted && (
          c.fullName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.ktpNumber.includes(q)
        )
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
    return Array.from(this.customers.values()).filter(c => !c.isDeleted).length;
  }
}
