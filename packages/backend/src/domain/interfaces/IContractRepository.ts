import { Contract } from '../entities';
import { ContractStatus } from '../enums';
import { PaginationParams, PaginatedResult } from './Pagination';

export interface IContractRepository {
  findAll(): Promise<Contract[]>;
  findAllPaginated(params: PaginationParams): Promise<PaginatedResult<Contract>>;
  findById(id: string): Promise<Contract | null>;
  findByIds(ids: string[]): Promise<Contract[]>;
  findByCustomerId(customerId: string): Promise<Contract[]>;
  findByStatus(status: ContractStatus): Promise<Contract[]>;
  create(contract: Contract): Promise<Contract>;
  update(id: string, data: Partial<Contract>): Promise<Contract | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  countByStatus(status: ContractStatus): Promise<number>;
  findMaxContractSequence(): Promise<number>;
  updateGracePeriodByStatuses(gracePeriodDays: number, statuses: ContractStatus[]): Promise<number>;

  /**
   * Atomically decrement saving balance. Returns updated contract or null if insufficient balance.
   * In Prisma: uses WHERE saving_balance >= amount for atomic safety.
   */
  atomicDecrementSavingBalance(contractId: string, amount: number): Promise<Contract | null>;

  /**
   * Find contracts with optional filters applied at DB level.
   * Only returns non-deleted contracts.
   */
  findFiltered(filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: ContractStatus;
    motorModel?: string;
    batteryType?: string;
  }): Promise<Contract[]>;
}
