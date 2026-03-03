import { AuditLog } from '../entities';
import { PaginationParams, PaginatedResult } from './Pagination';

export interface IAuditLogRepository {
  findAll(): Promise<AuditLog[]>;
  findAllPaginated(params: PaginationParams): Promise<PaginatedResult<AuditLog>>;
  findByUserId(userId: string): Promise<AuditLog[]>;
  findByModule(module: string): Promise<AuditLog[]>;
  findRecent(limit: number): Promise<AuditLog[]>;
  create(log: AuditLog): Promise<AuditLog>;
  count(): Promise<number>;
}
