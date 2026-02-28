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
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export const MOTOR_DAILY_RATES: Record<MotorModel, number> = {
  [MotorModel.ATHENA]: 55000,
  [MotorModel.VICTORY]: 55000,
  [MotorModel.EDPOWER]: 75000,
};

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  ktpNumber: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  customerId: string;
  motorModel: MotorModel;
  dailyRate: number;
  durationDays: number;
  totalAmount: number;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  contractId: string;
  customerId: string;
  amount: number;
  status: PaymentStatus;
  qrCodeData: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  module: string;
  entityId: string;
  description: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalCustomers: number;
  totalContracts: number;
  activeContracts: number;
  completedContracts: number;
  overdueContracts: number;
  pendingPayments: number;
  totalRevenue: number;
  pendingRevenue: number;
  recentActivity: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: string;
  }>;
}

export interface LoginResponse {
  token: string;
  user: User;
}
