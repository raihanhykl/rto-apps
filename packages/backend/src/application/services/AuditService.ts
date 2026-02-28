import { IAuditLogRepository } from '../../domain/interfaces';
import { AuditLog } from '../../domain/entities';

export class AuditService {
  constructor(private auditRepo: IAuditLogRepository) {}

  async getAll(): Promise<AuditLog[]> {
    return this.auditRepo.findAll();
  }

  async getByUserId(userId: string): Promise<AuditLog[]> {
    return this.auditRepo.findByUserId(userId);
  }

  async getByModule(module: string): Promise<AuditLog[]> {
    return this.auditRepo.findByModule(module);
  }

  async getRecent(limit: number = 50): Promise<AuditLog[]> {
    return this.auditRepo.findRecent(limit);
  }

  async count(): Promise<number> {
    return this.auditRepo.count();
  }
}
