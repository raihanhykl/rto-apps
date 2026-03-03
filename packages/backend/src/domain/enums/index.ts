export enum MotorModel {
  ATHENA = 'ATHENA',
  VICTORY = 'VICTORY',
  EDPOWER = 'EDPOWER',
}

export enum ContractStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  REPOSSESSED = 'REPOSSESSED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  VOID = 'VOID',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PAYMENT = 'PAYMENT',
  EXPORT = 'EXPORT',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER',
}

export const MOTOR_DAILY_RATES: Record<MotorModel, number> = {
  [MotorModel.ATHENA]: 55000,
  [MotorModel.VICTORY]: 55000,
  [MotorModel.EDPOWER]: 75000,
};

export const MAX_RENTAL_DAYS = 7;
export const DEFAULT_OWNERSHIP_TARGET_DAYS = 1825; // 5 years
export const DEFAULT_GRACE_PERIOD_DAYS = 7;

export const VALID_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.ACTIVE]: [ContractStatus.OVERDUE, ContractStatus.COMPLETED, ContractStatus.CANCELLED, ContractStatus.REPOSSESSED],
  [ContractStatus.OVERDUE]: [ContractStatus.ACTIVE, ContractStatus.COMPLETED, ContractStatus.CANCELLED, ContractStatus.REPOSSESSED],
  [ContractStatus.COMPLETED]: [],
  [ContractStatus.CANCELLED]: [],
  [ContractStatus.REPOSSESSED]: [],
};
