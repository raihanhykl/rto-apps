export enum MotorModel {
  ATHENA = 'ATHENA',
  VICTORY = 'VICTORY',
  EDPOWER = 'EDPOWER',
}

export enum BatteryType {
  REGULAR = 'REGULAR',
  EXTENDED = 'EXTENDED',
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

export enum InvoiceType {
  DP = 'DP',
  DP_INSTALLMENT = 'DP_INSTALLMENT',
  DAILY_BILLING = 'DAILY_BILLING',
  MANUAL_PAYMENT = 'MANUAL_PAYMENT',
}

export enum BillingStatus {
  ACTIVE = 'ACTIVE',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum DPScheme {
  FULL = 'FULL',
  INSTALLMENT = 'INSTALLMENT',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
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

export const MOTOR_DAILY_RATES: Record<string, number> = {
  'ATHENA_REGULAR': 58000,
  'ATHENA_EXTENDED': 63000,
  'VICTORY_REGULAR': 58000,
  'VICTORY_EXTENDED': 63000,
  'EDPOWER_REGULAR': 83000,
  'EDPOWER_EXTENDED': 83000,
};

export const DP_AMOUNTS: Record<string, number> = {
  'ATHENA_REGULAR': 530000,
  'ATHENA_EXTENDED': 580000,
  'VICTORY_REGULAR': 530000,
  'VICTORY_EXTENDED': 580000,
  'EDPOWER_REGULAR': 780000,
  'EDPOWER_EXTENDED': 780000,
};

export const MAX_RENTAL_DAYS = 7;
export const DEFAULT_OWNERSHIP_TARGET_DAYS = 1278;
export const DEFAULT_GRACE_PERIOD_DAYS = 7;
export const DEFAULT_HOLIDAY_DAYS_PER_MONTH = 2;
export const MIN_HOLIDAY_DAYS_PER_MONTH = 2;
export const MAX_HOLIDAY_DAYS_PER_MONTH = 4;

export const VALID_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.ACTIVE]: [ContractStatus.OVERDUE, ContractStatus.COMPLETED, ContractStatus.CANCELLED, ContractStatus.REPOSSESSED],
  [ContractStatus.OVERDUE]: [ContractStatus.ACTIVE, ContractStatus.COMPLETED, ContractStatus.CANCELLED, ContractStatus.REPOSSESSED],
  [ContractStatus.COMPLETED]: [],
  [ContractStatus.CANCELLED]: [],
  [ContractStatus.REPOSSESSED]: [],
};
