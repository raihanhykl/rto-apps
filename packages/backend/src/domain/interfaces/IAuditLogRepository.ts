import { AuditLog } from '../entities';

export interface IAuditLogRepository {
  findAll(): Promise<AuditLog[]>;
  findByUserId(userId: string): Promise<AuditLog[]>;
  findByModule(module: string): Promise<AuditLog[]>;
  findRecent(limit: number): Promise<AuditLog[]>;
  create(log: AuditLog): Promise<AuditLog>;
  count(): Promise<number>;
}
