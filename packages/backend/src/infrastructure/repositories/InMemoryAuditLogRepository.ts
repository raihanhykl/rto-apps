import { AuditLog } from '../../domain/entities';
import { IAuditLogRepository } from '../../domain/interfaces';
import { PaginationParams, PaginatedResult } from '../../domain/interfaces/Pagination';

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private logs: AuditLog[] = [];

  async findAll(): Promise<AuditLog[]> {
    return [...this.logs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<AuditLog>> {
    let items = [...this.logs];
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (l) => l.description.toLowerCase().includes(q) || l.action.toLowerCase().includes(q),
      );
    }
    if (params.module) {
      items = items.filter((l) => l.module === params.module);
    }
    if (params.startDate) {
      const s = new Date(params.startDate);
      items = items.filter((l) => l.createdAt >= s);
    }
    if (params.endDate) {
      const e = new Date(params.endDate);
      e.setDate(e.getDate() + 1);
      items = items.filter((l) => l.createdAt < e);
    }
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    items.sort((a, b) => {
      const aVal = String((a as unknown as Record<string, unknown>)[sortBy] ?? '');
      const bVal = String((b as unknown as Record<string, unknown>)[sortBy] ?? '');
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

  async findByUserId(userId: string): Promise<AuditLog[]> {
    return this.logs
      .filter((l) => l.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByModule(module: string): Promise<AuditLog[]> {
    return this.logs
      .filter((l) => l.module === module)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findRecent(limit: number): Promise<AuditLog[]> {
    return [...this.logs]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async create(log: AuditLog): Promise<AuditLog> {
    this.logs.push({ ...log });
    return { ...log };
  }

  async count(): Promise<number> {
    return this.logs.length;
  }
}
