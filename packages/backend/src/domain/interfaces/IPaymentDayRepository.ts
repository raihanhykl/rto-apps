import { PaymentDay } from '../entities/PaymentDay';
import { PaymentDayStatus } from '../enums';

export interface IPaymentDayRepository {
  findById(id: string): Promise<PaymentDay | null>;
  findByContractId(contractId: string): Promise<PaymentDay[]>;
  findByContractAndDateRange(contractId: string, startDate: Date, endDate: Date): Promise<PaymentDay[]>;
  findByPaymentId(paymentId: string): Promise<PaymentDay[]>;
  findByContractAndDate(contractId: string, date: Date): Promise<PaymentDay | null>;
  findByContractAndStatus(contractId: string, status: PaymentDayStatus): Promise<PaymentDay[]>;

  create(paymentDay: PaymentDay): Promise<PaymentDay>;
  createMany(paymentDays: PaymentDay[]): Promise<number>;
  update(id: string, data: Partial<PaymentDay>): Promise<PaymentDay | null>;
  updateByContractAndDate(contractId: string, date: Date, data: Partial<PaymentDay>): Promise<PaymentDay | null>;
  updateManyByPaymentId(paymentId: string, data: Partial<PaymentDay>): Promise<number>;

  countByContractAndStatus(contractId: string, status: PaymentDayStatus): Promise<number>;
  countByContractAndStatuses(contractId: string, statuses: PaymentDayStatus[]): Promise<number>;
  findLastPaidOrHolidayDate(contractId: string): Promise<Date | null>;
}
