import { AuditAction } from '../enums';

export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  module: string;
  entityId: string;
  description: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  createdAt: Date;
}
