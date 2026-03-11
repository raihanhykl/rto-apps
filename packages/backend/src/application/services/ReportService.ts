import {
  IContractRepository,
  ICustomerRepository,
  IInvoiceRepository,
} from '../../domain/interfaces';
import { Contract, Customer, Invoice } from '../../domain/entities';
import { ContractStatus, PaymentStatus, MotorModel, BatteryType } from '../../domain/enums';
import { getWibToday, getWibParts } from '../../domain/utils/dateUtils';

export interface ReportData {
  generatedAt: Date;
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

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  status?: ContractStatus;
  motorModel?: MotorModel;
  batteryType?: BatteryType;
}

export class ReportService {
  constructor(
    private contractRepo: IContractRepository,
    private customerRepo: ICustomerRepository,
    private invoiceRepo: IInvoiceRepository
  ) {}

  async generateReport(filters?: ReportFilters): Promise<ReportData> {
    const [allContracts, allInvoices, customers] = await Promise.all([
      this.contractRepo.findAll(),
      this.invoiceRepo.findAll(),
      this.customerRepo.findAll(),
    ]);

    const customerMap = new Map<string, Customer>();
    customers.forEach(c => customerMap.set(c.id, c));

    // Filter contracts
    let contracts = allContracts.filter(c => !c.isDeleted);
    let invoices = allInvoices;

    if (filters?.startDate) {
      const start = new Date(filters.startDate);
      contracts = contracts.filter(c => c.createdAt >= start);
      invoices = invoices.filter(i => i.createdAt >= start);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      contracts = contracts.filter(c => c.createdAt <= end);
      invoices = invoices.filter(i => i.createdAt <= end);
    }
    if (filters?.status) {
      contracts = contracts.filter(c => c.status === filters.status);
    }
    if (filters?.motorModel) {
      contracts = contracts.filter(c => c.motorModel === filters.motorModel);
    }
    if (filters?.batteryType) {
      contracts = contracts.filter(c => c.batteryType === filters.batteryType);
    }

    // Filter invoices to match filtered contracts
    const contractIds = new Set(contracts.map(c => c.id));
    if (filters?.status || filters?.motorModel || filters?.batteryType) {
      invoices = invoices.filter(i => contractIds.has(i.contractId));
    }

    const enrichedContracts = contracts.map(contract => ({
      ...contract,
      customerName: customerMap.get(contract.customerId)?.fullName || 'Unknown',
    }));

    const enrichedInvoices = invoices.map(invoice => ({
      ...invoice,
      customerName: customerMap.get(invoice.customerId)?.fullName || 'Unknown',
    }));

    // Calculate summary
    const paidInvoices = invoices.filter(i => i.status === PaymentStatus.PAID);
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.amount + i.lateFee, 0);
    const pendingAmount = invoices
      .filter(i => i.status === PaymentStatus.PENDING)
      .reduce((sum, i) => sum + i.amount, 0);

    // Contracts by status
    const contractsByStatus: Record<string, number> = {};
    for (const status of Object.values(ContractStatus)) {
      contractsByStatus[status] = contracts.filter(c => c.status === status).length;
    }

    // Revenue by motor model
    const revenueByMotor: Record<string, number> = {};
    for (const model of Object.values(MotorModel)) {
      const modelContracts = contracts.filter(c => c.motorModel === model);
      const modelContractIds = new Set(modelContracts.map(c => c.id));
      revenueByMotor[model] = paidInvoices
        .filter(i => modelContractIds.has(i.contractId))
        .reduce((sum, i) => sum + i.amount + i.lateFee, 0);
    }

    // Revenue by month (last 6 months)
    const revenueByMonth: Array<{ month: string; revenue: number }> = [];
    const todayParts = getWibParts(getWibToday());
    for (let m = 5; m >= 0; m--) {
      const d = new Date(todayParts.year, todayParts.month - 1 - m, 1);
      const wibD = getWibParts(d);
      const month = `${wibD.year}-${String(wibD.month).padStart(2, '0')}`;
      const monthRevenue = paidInvoices
        .filter(i => {
          if (!i.paidAt) return false;
          const pd = i.paidAt instanceof Date ? i.paidAt : new Date(i.paidAt);
          const wibPd = getWibParts(pd);
          return `${wibPd.year}-${String(wibPd.month).padStart(2, '0')}` === month;
        })
        .reduce((sum, i) => sum + i.amount + i.lateFee, 0);
      revenueByMonth.push({ month, revenue: monthRevenue });
    }

    // Top customers by total paid
    const customerPayments = new Map<string, { name: string; totalPaid: number; contractCount: number }>();
    for (const inv of paidInvoices) {
      const existing = customerPayments.get(inv.customerId) || {
        name: customerMap.get(inv.customerId)?.fullName || 'Unknown',
        totalPaid: 0,
        contractCount: 0,
      };
      existing.totalPaid += inv.amount + inv.lateFee;
      customerPayments.set(inv.customerId, existing);
    }
    for (const contract of contracts) {
      const existing = customerPayments.get(contract.customerId);
      if (existing && !existing.contractCount) {
        existing.contractCount = contracts.filter(c => c.customerId === contract.customerId).length;
      }
    }
    const topCustomers = Array.from(customerPayments.values())
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, 10);

    const overdueCount = contracts.filter(c => c.status === ContractStatus.OVERDUE).length;
    const activeContracts = contracts.filter(c =>
      c.status === ContractStatus.ACTIVE || c.status === ContractStatus.OVERDUE || c.status === ContractStatus.COMPLETED
    );
    const averageOwnershipProgress = activeContracts.length > 0
      ? parseFloat((activeContracts.reduce((sum, c) => sum + c.ownershipProgress, 0) / activeContracts.length).toFixed(1))
      : 0;

    const period = filters?.startDate || filters?.endDate
      ? `${filters.startDate || 'Start'} - ${filters.endDate || 'Now'}`
      : 'All Time';

    return {
      generatedAt: new Date(),
      period,
      contracts: enrichedContracts,
      invoices: enrichedInvoices,
      summary: {
        totalContracts: contracts.length,
        totalInvoices: invoices.length,
        totalRevenue,
        pendingAmount,
        contractsByStatus,
        revenueByMotor,
        revenueByMonth,
        topCustomers,
        overdueCount,
        averageOwnershipProgress,
      },
    };
  }

  async exportJSON(filters?: ReportFilters): Promise<string> {
    const report = await this.generateReport(filters);
    return JSON.stringify(report, null, 2);
  }

  async exportCSV(filters?: ReportFilters): Promise<string> {
    const report = await this.generateReport(filters);
    const headers = [
      'Contract Number',
      'Customer',
      'Motor Model',
      'Duration (Days)',
      'Daily Rate',
      'Total Amount',
      'Status',
      'Ownership Progress',
      'Total Days Paid',
      'Working Days Paid',
      'Holiday Days Paid',
      'Start Date',
      'End Date',
    ];

    const rows = report.contracts.map(c => [
      c.contractNumber,
      `"${c.customerName}"`,
      c.motorModel,
      c.durationDays,
      c.dailyRate,
      c.totalAmount,
      c.status,
      `${c.ownershipProgress}%`,
      c.totalDaysPaid,
      c.workingDaysPaid,
      c.holidayDaysPaid,
      c.startDate instanceof Date ? c.startDate.toISOString().split('T')[0] : String(c.startDate).split('T')[0],
      c.endDate instanceof Date ? c.endDate.toISOString().split('T')[0] : String(c.endDate).split('T')[0],
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  async exportXLSV(filters?: ReportFilters): Promise<string> {
    // Tab-separated values (importable to Excel)
    const report = await this.generateReport(filters);

    const sections: string[] = [];

    sections.push('=== SUMMARY ===');
    sections.push(`Generated At\t${report.generatedAt.toISOString()}`);
    sections.push(`Period\t${report.period}`);
    sections.push(`Total Contracts\t${report.summary.totalContracts}`);
    sections.push(`Total Invoices\t${report.summary.totalInvoices}`);
    sections.push(`Total Revenue\t${report.summary.totalRevenue}`);
    sections.push(`Pending Amount\t${report.summary.pendingAmount}`);
    sections.push(`Overdue Count\t${report.summary.overdueCount}`);
    sections.push(`Avg Ownership Progress\t${report.summary.averageOwnershipProgress}%`);
    sections.push('');

    sections.push('=== CONTRACTS BY STATUS ===');
    for (const [status, count] of Object.entries(report.summary.contractsByStatus)) {
      sections.push(`${status}\t${count}`);
    }
    sections.push('');

    sections.push('=== REVENUE BY MOTOR MODEL ===');
    for (const [model, revenue] of Object.entries(report.summary.revenueByMotor)) {
      sections.push(`${model}\t${revenue}`);
    }
    sections.push('');

    sections.push('=== REVENUE BY MONTH ===');
    sections.push('Month\tRevenue');
    for (const { month, revenue } of report.summary.revenueByMonth) {
      sections.push(`${month}\t${revenue}`);
    }
    sections.push('');

    sections.push('=== TOP CUSTOMERS ===');
    sections.push('Customer\tTotal Paid\tContracts');
    for (const cust of report.summary.topCustomers) {
      sections.push(`${cust.name}\t${cust.totalPaid}\t${cust.contractCount}`);
    }
    sections.push('');

    sections.push('=== CONTRACT DETAILS ===');
    const contractHeaders = ['Contract Number', 'Customer', 'Motor', 'Status', 'Days Paid', 'Working Days', 'Holiday Days', 'Ownership %', 'Total Amount', 'Start Date', 'End Date'];
    sections.push(contractHeaders.join('\t'));
    for (const c of report.contracts) {
      sections.push([
        c.contractNumber,
        c.customerName,
        c.motorModel,
        c.status,
        c.totalDaysPaid,
        c.workingDaysPaid,
        c.holidayDaysPaid,
        `${c.ownershipProgress}%`,
        c.totalAmount,
        c.startDate instanceof Date ? c.startDate.toISOString().split('T')[0] : String(c.startDate).split('T')[0],
        c.endDate instanceof Date ? c.endDate.toISOString().split('T')[0] : String(c.endDate).split('T')[0],
      ].join('\t'));
    }

    return sections.join('\n');
  }
}
