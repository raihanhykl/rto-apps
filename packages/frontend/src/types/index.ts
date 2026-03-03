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

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  birthDate: string | null;
  gender: Gender | null;
  rideHailingApps: string[];
  ktpNumber: string;
  // Document photos
  ktpPhoto: string | null;
  simPhoto: string | null;
  kkPhoto: string | null;
  // Guarantor
  guarantorName: string;
  guarantorPhone: string;
  guarantorKtpPhoto: string | null;
  // Spouse (optional)
  spouseName: string;
  spouseKtpPhoto: string | null;
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
  batteryType: BatteryType;
  dailyRate: number;
  durationDays: number;
  totalAmount: number;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  notes: string;
  createdBy: string;
  // Unit details
  color: string;
  year: number | null;
  vinNumber: string;
  engineNumber: string;
  // DP fields
  dpAmount: number;
  dpScheme: DPScheme;
  dpPaidAmount: number;
  dpFullyPaid: boolean;
  // Unit delivery & billing
  unitReceivedDate: string | null;
  billingStartDate: string | null;
  bastPhoto: string | null;
  bastNotes: string;
  holidayDaysPerMonth: number;
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
  type: InvoiceType;
  status: PaymentStatus;
  qrCodeData: string;
  dueDate: string;
  paidAt: string | null;
  extensionDays: number | null;
  // DOKU payment gateway
  dokuPaymentUrl: string | null;
  dokuReferenceId: string | null;
  // Billing period
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  billingId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Billing {
  id: string;
  billingNumber: string;
  contractId: string;
  customerId: string;
  amount: number;
  dailyRate: number;
  daysCount: number;
  status: BillingStatus;
  dokuPaymentUrl: string | null;
  dokuReferenceId: string | null;
  periodStart: string;
  periodEnd: string;
  expiredAt: string | null;
  paidAt: string | null;
  invoiceId: string | null;
  previousBillingId: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
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
