import { AuditLog } from '../../domain/entities';
import { IAuditLogRepository } from '../../domain/interfaces';

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private logs: AuditLog[] = [];

  async findAll(): Promise<AuditLog[]> {
    return [...this.logs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    return this.logs
      .filter(l => l.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByModule(module: string): Promise<AuditLog[]> {
    return this.logs
      .filter(l => l.module === module)
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
