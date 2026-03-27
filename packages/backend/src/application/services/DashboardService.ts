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
  cancelledContracts: number;
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
    private auditRepo: IAuditLogRepository,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const [
      totalCustomers,
      totalContracts,
      activeContracts,
      completedContracts,
      overdueContracts,
      repossessedContracts,
      cancelledContracts,
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
      this.contractRepo.countByStatus(ContractStatus.CANCELLED),
      this.invoiceRepo.countByStatus(PaymentStatus.PENDING),
      this.invoiceRepo.sumByStatus(PaymentStatus.PAID),
      this.invoiceRepo.sumByStatus(PaymentStatus.PENDING),
      this.auditRepo.findRecent(10),
    ]);

    // Revenue by month (last 6 months) — aggregate query, not findAll
    const revenueByMonthRaw = await this.invoiceRepo.getRevenueByMonth(6);
    const revenueByMonth = revenueByMonthRaw.map(({ month, revenue }) => {
      const [y, m] = month.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = d.toLocaleDateString('id-ID', {
        month: 'short',
        year: '2-digit',
        timeZone: 'Asia/Jakarta',
      });
      return { month: label, revenue };
    });

    // Contracts by status
    const contractsByStatus: Record<string, number> = {
      ACTIVE: activeContracts,
      COMPLETED: completedContracts,
      OVERDUE: overdueContracts,
      REPOSSESSED: repossessedContracts,
    };
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
      cancelledContracts,
      pendingPayments,
      totalRevenue,
      pendingRevenue,
      recentActivity: recentLogs.map((log) => ({
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
