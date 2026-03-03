import { Customer } from '../entities';
import { PaginationParams, PaginatedResult } from './Pagination';

export interface ICustomerRepository {
  findAll(): Promise<Customer[]>;
  findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Customer>>;
  findById(id: string): Promise<Customer | null>;
  findByKtpNumber(ktpNumber: string): Promise<Customer | null>;
  search(query: string): Promise<Customer[]>;
  create(customer: Customer): Promise<Customer>;
  update(id: string, data: Partial<Customer>): Promise<Customer | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}
