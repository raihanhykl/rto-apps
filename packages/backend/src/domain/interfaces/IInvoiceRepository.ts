import { Invoice } from '../entities';
import { PaymentStatus } from '../enums';
import { PaginationParams, PaginatedResult } from './Pagination';

export interface IInvoiceRepository {
  findAll(): Promise<Invoice[]>;
  findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Invoice>>;
  findById(id: string): Promise<Invoice | null>;
  findByContractId(contractId: string): Promise<Invoice[]>;
  findByCustomerId(customerId: string): Promise<Invoice[]>;
  findByStatus(status: PaymentStatus): Promise<Invoice[]>;
  findActiveByContractId(contractId: string): Promise<Invoice | null>;
  search(query: string): Promise<Invoice[]>;
  create(invoice: Invoice): Promise<Invoice>;
  update(id: string, data: Partial<Invoice>): Promise<Invoice | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  countByStatus(status: PaymentStatus): Promise<number>;
  sumByStatus(status: PaymentStatus): Promise<number>;
  findMaxInvoiceSequence(): Promise<number>;
}
