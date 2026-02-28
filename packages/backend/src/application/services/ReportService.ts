import {
  IContractRepository,
  ICustomerRepository,
  IInvoiceRepository,
} from '../../domain/interfaces';
import { Contract, Customer, Invoice } from '../../domain/entities';

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
  };
}

export class ReportService {
  constructor(
    private contractRepo: IContractRepository,
    private customerRepo: ICustomerRepository,
    private invoiceRepo: IInvoiceRepository
  ) {}

  async generateReport(): Promise<ReportData> {
    const [contracts, invoices, customers] = await Promise.all([
      this.contractRepo.findAll(),
      this.invoiceRepo.findAll(),
      this.customerRepo.findAll(),
    ]);

    const customerMap = new Map<string, Customer>();
    customers.forEach(c => customerMap.set(c.id, c));

    const enrichedContracts = contracts.map(contract => ({
      ...contract,
      customerName: customerMap.get(contract.customerId)?.fullName || 'Unknown',
    }));

    const enrichedInvoices = invoices.map(invoice => ({
      ...invoice,
      customerName: customerMap.get(invoice.customerId)?.fullName || 'Unknown',
    }));

    const totalRevenue = invoices
      .filter(i => i.status === 'PAID')
      .reduce((sum, i) => sum + i.amount, 0);

    const pendingAmount = invoices
      .filter(i => i.status === 'PENDING')
      .reduce((sum, i) => sum + i.amount, 0);

    return {
      generatedAt: new Date(),
      period: 'All Time',
      contracts: enrichedContracts,
      invoices: enrichedInvoices,
      summary: {
        totalContracts: contracts.length,
        totalInvoices: invoices.length,
        totalRevenue,
        pendingAmount,
      },
    };
  }

  async exportJSON(): Promise<string> {
    const report = await this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  async exportCSV(): Promise<string> {
    const report = await this.generateReport();
    const headers = [
      'Contract Number',
      'Customer',
      'Motor Model',
      'Duration (Days)',
      'Daily Rate',
      'Total Amount',
      'Status',
      'Start Date',
      'End Date',
    ];

    const rows = report.contracts.map(c => [
      c.contractNumber,
      c.customerName,
      c.motorModel,
      c.durationDays,
      c.dailyRate,
      c.totalAmount,
      c.status,
      c.startDate instanceof Date ? c.startDate.toISOString().split('T')[0] : c.startDate,
      c.endDate instanceof Date ? c.endDate.toISOString().split('T')[0] : c.endDate,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}
