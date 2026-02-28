import {
  IContractRepository,
  ICustomerRepository,
  IInvoiceRepository,
  IAuditLogRepository,
} from '../../domain/interfaces';
import { ContractStatus, PaymentStatus } from '../../domain/enums';

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
    createdAt: Date;
  }>;
}

export class DashboardService {
  constructor(
    private contractRepo: IContractRepository,
    private customerRepo: ICustomerRepository,
    private invoiceRepo: IInvoiceRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async getStats(): Promise<DashboardStats> {
    const [
      totalCustomers,
      totalContracts,
      activeContracts,
      completedContracts,
      overdueContracts,
      pendingPayments,
      totalRevenue,
      pendingRevenue,
      recentLogs,
    ] = await Promise.all([
      this.customerRepo.count(),
      this.contractRepo.count(),
      this.contractRepo.countByStatus(ContractStatus.ACTIVE),
      this.contractRepo.countByStatus(ContractStatus.COMPLETED),
      this.contractRepo.countByStatus(ContractStatus.OVERDUE),
      this.invoiceRepo.countByStatus(PaymentStatus.PENDING),
      this.invoiceRepo.sumByStatus(PaymentStatus.PAID),
      this.invoiceRepo.sumByStatus(PaymentStatus.PENDING),
      this.auditRepo.findRecent(10),
    ]);

    return {
      totalCustomers,
      totalContracts,
      activeContracts,
      completedContracts,
      overdueContracts,
      pendingPayments,
      totalRevenue,
      pendingRevenue,
      recentActivity: recentLogs.map(log => ({
        id: log.id,
        action: log.action,
        description: log.description,
        createdAt: log.createdAt,
      })),
    };
  }
}
