import { IContractRepository } from './IContractRepository';
import { IInvoiceRepository } from './IInvoiceRepository';
import { IPaymentDayRepository } from './IPaymentDayRepository';
import { IAuditLogRepository } from './IAuditLogRepository';
import { ISavingTransactionRepository } from './ISavingTransactionRepository';
import { IServiceRecordRepository } from './IServiceRecordRepository';
import { ICustomerRepository } from './ICustomerRepository';
import { ISettingRepository } from './ISettingRepository';

export interface TransactionalRepos {
  contractRepo: IContractRepository;
  invoiceRepo: IInvoiceRepository;
  paymentDayRepo: IPaymentDayRepository;
  auditRepo: IAuditLogRepository;
  savingTxRepo: ISavingTransactionRepository;
  serviceRecordRepo: IServiceRecordRepository;
  customerRepo: ICustomerRepository;
  settingRepo: ISettingRepository;
}

export interface ITransactionManager {
  /**
   * Execute a function within a database transaction.
   * All repository operations inside the callback use the same transaction.
   * If the callback throws, all changes are rolled back.
   */
  runInTransaction<T>(fn: (repos: TransactionalRepos) => Promise<T>): Promise<T>;
}
