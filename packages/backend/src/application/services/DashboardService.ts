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
  repossessedContracts: number;
  pendingPayments: number;
  totalRevenue: number;
  pendingRevenue: number;
  recentActivity: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: Date;
  }>;
  chartData: {
    revenueByMonth: Array<{ month: string; revenue: number }>;
    contractsByStatus: Record<string, number>;
  };
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
      repossessedContracts,
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
      this.contractRepo.countByStatus(ContractStatus.REPOSSESSED),
      this.invoiceRepo.countByStatus(PaymentStatus.PENDING),
      this.invoiceRepo.sumByStatus(PaymentStatus.PAID),
      this.invoiceRepo.sumByStatus(PaymentStatus.PENDING),
      this.auditRepo.findRecent(10),
    ]);

    // Build chart data
    const allInvoices = await this.invoiceRepo.findAll();
    const paidInvoices = allInvoices.filter(inv => inv.status === PaymentStatus.PAID);

    // Revenue by month (last 6 months)
    const now = new Date();
    const revenueByMonth: Array<{ month: string; revenue: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
      const revenue = paidInvoices
        .filter(inv => {
          const paidDate = inv.paidAt ? new Date(inv.paidAt) : null;
          return paidDate && paidDate.getMonth() === d.getMonth() && paidDate.getFullYear() === d.getFullYear();
        })
        .reduce((sum, inv) => sum + inv.amount + (inv.lateFee || 0), 0);
      revenueByMonth.push({ month: monthStr, revenue });
    }

    // Contracts by status
    const contractsByStatus: Record<string, number> = {
      ACTIVE: activeContracts,
      COMPLETED: completedContracts,
      OVERDUE: overdueContracts,
      REPOSSESSED: repossessedContracts,
    };
    const cancelledContracts = await this.contractRepo.countByStatus(ContractStatus.CANCELLED);
    if (cancelledContracts > 0) {
      contractsByStatus.CANCELLED = cancelledContracts;
    }

    return {
      totalCustomers,
      totalContracts,
      activeContracts,
      completedContracts,
      overdueContracts,
      repossessedContracts,
      pendingPayments,
      totalRevenue,
      pendingRevenue,
      recentActivity: recentLogs.map(log => ({
        id: log.id,
        action: log.action,
        description: log.description,
        createdAt: log.createdAt,
      })),
      chartData: {
        revenueByMonth,
        contractsByStatus,
      },
    };
  }
}
