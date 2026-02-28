import { Invoice } from '../entities';
import { PaymentStatus } from '../enums';

export interface IInvoiceRepository {
  findAll(): Promise<Invoice[]>;
  findById(id: string): Promise<Invoice | null>;
  findByContractId(contractId: string): Promise<Invoice | null>;
  findByCustomerId(customerId: string): Promise<Invoice[]>;
  findByStatus(status: PaymentStatus): Promise<Invoice[]>;
  create(invoice: Invoice): Promise<Invoice>;
  update(id: string, data: Partial<Invoice>): Promise<Invoice | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  countByStatus(status: PaymentStatus): Promise<number>;
  sumByStatus(status: PaymentStatus): Promise<number>;
}
