import { Billing } from '../entities';
import { BillingStatus } from '../enums';
import { PaginationParams, PaginatedResult } from './Pagination';

export interface IBillingRepository {
  findAll(): Promise<Billing[]>;
  findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Billing>>;
  findById(id: string): Promise<Billing | null>;
  findByContractId(contractId: string): Promise<Billing[]>;
  findByCustomerId(customerId: string): Promise<Billing[]>;
  findByStatus(status: BillingStatus): Promise<Billing[]>;
  findActiveByContractId(contractId: string): Promise<Billing | null>;
  create(billing: Billing): Promise<Billing>;
  update(id: string, data: Partial<Billing>): Promise<Billing | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  countByStatus(status: BillingStatus): Promise<number>;
  findMaxBillingSequence(): Promise<number>;
}
