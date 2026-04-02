import { Invoice } from '../entities';
import { PaymentStatus } from '../enums';
import { PaginationParams, PaginatedResult } from './Pagination';

export interface IInvoiceRepository {
  findAll(): Promise<Invoice[]>;
  findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Invoice>>;
  findById(id: string): Promise<Invoice | null>;
  findByContractId(contractId: string): Promise<Invoice[]>;
  findByContractIds(contractIds: string[]): Promise<Invoice[]>;
  findActiveByContractIds(contractIds: string[]): Promise<Map<string, Invoice>>;
  findByCustomerId(customerId: string): Promise<Invoice[]>;
  findByStatus(status: PaymentStatus): Promise<Invoice[]>;
  findActiveByContractId(contractId: string): Promise<Invoice | null>;
  findAllPendingByContractId(contractId: string): Promise<Invoice[]>;
  search(query: string): Promise<Invoice[]>;
  create(invoice: Invoice): Promise<Invoice>;
  update(id: string, data: Partial<Invoice>): Promise<Invoice | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  countByStatus(status: PaymentStatus): Promise<number>;
  sumByStatus(status: PaymentStatus): Promise<number>;
  findMaxInvoiceSequence(): Promise<number>;

  /**
   * Aggregate revenue (amount + lateFee) for PAID invoices grouped by month (WIB timezone).
   * Returns last N months sorted chronologically (oldest first).
   */
  getRevenueByMonth(months: number): Promise<Array<{ month: string; revenue: number }>>;

  /**
   * Find invoices filtered by date range and/or contract IDs at the DB level.
   * All parameters are optional — omitted params mean no filter on that dimension.
   */
  findByDateRange(startDate?: Date, endDate?: Date, contractIds?: string[]): Promise<Invoice[]>;

  findPaginatedByContractId(
    contractId: string,
    page: number,
    limit: number,
    sortOrder?: 'asc' | 'desc',
  ): Promise<{ data: Invoice[]; total: number }>;
}
