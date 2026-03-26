import { ServiceRecord } from '../entities/ServiceRecord';

export interface IServiceRecordRepository {
  findById(id: string): Promise<ServiceRecord | null>;
  findByContractId(contractId: string): Promise<ServiceRecord[]>;
  findActiveByContractId(contractId: string): Promise<ServiceRecord[]>;
  findActiveByContractAndDateRange(
    contractId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ServiceRecord[]>;
  create(record: ServiceRecord): Promise<ServiceRecord>;
  update(id: string, data: Partial<ServiceRecord>): Promise<ServiceRecord>;
}
