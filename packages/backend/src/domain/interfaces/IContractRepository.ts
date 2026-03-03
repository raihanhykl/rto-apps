import { Contract } from '../entities';
import { ContractStatus } from '../enums';
import { PaginationParams, PaginatedResult } from './Pagination';

export interface IContractRepository {
  findAll(): Promise<Contract[]>;
  findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Contract>>;
  findById(id: string): Promise<Contract | null>;
  findByCustomerId(customerId: string): Promise<Contract[]>;
  findByStatus(status: ContractStatus): Promise<Contract[]>;
  create(contract: Contract): Promise<Contract>;
  update(id: string, data: Partial<Contract>): Promise<Contract | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  countByStatus(status: ContractStatus): Promise<number>;
}
