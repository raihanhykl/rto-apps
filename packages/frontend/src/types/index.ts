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
  isDeleted: boolean;
  deletedAt: string | null;
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
  // RTO fields
  ownershipTargetDays: number;
  totalDaysPaid: number;
  ownershipProgress: number;
  gracePeriodDays: number;
  repossessedAt: string | null;
  completedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  contractId: string;
  customerId: string;
  amount: number;
  lateFee: number;
  status: PaymentStatus;
  qrCodeData: string;
  dueDate: string;
  paidAt: string | null;
  extensionDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportData {
  generatedAt: string;
  period: string;
  contracts: Array<Contract & { customerName: string }>;
  invoices: Array<Invoice & { customerName: string }>;
  summary: {
    totalContracts: number;
    totalInvoices: number;
    totalRevenue: number;
    pendingAmount: number;
    contractsByStatus: Record<string, number>;
    revenueByMotor: Record<string, number>;
    revenueByMonth: Array<{ month: string; revenue: number }>;
    topCustomers: Array<{ name: string; totalPaid: number; contractCount: number }>;
    overdueCount: number;
    averageOwnershipProgress: number;
  };
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
  repossessedContracts: number;
  pendingPayments: number;
  totalRevenue: number;
  pendingRevenue: number;
  recentActivity: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: string;
  }>;
  chartData: {
    revenueByMonth: Array<{ month: string; revenue: number }>;
    contractsByStatus: Record<string, number>;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LoginResponse {
  token: string;
  user: User;
}
