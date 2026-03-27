import { PrismaClient } from '@prisma/client';
import {
  ITransactionManager,
  TransactionalRepos,
} from '../../domain/interfaces/ITransactionManager';
import { PrismaContractRepository } from '../repositories/PrismaContractRepository';
import { PrismaInvoiceRepository } from '../repositories/PrismaInvoiceRepository';
import { PrismaPaymentDayRepository } from '../repositories/PrismaPaymentDayRepository';
import { PrismaAuditLogRepository } from '../repositories/PrismaAuditLogRepository';
import { PrismaSavingTransactionRepository } from '../repositories/PrismaSavingTransactionRepository';
import { PrismaServiceRecordRepository } from '../repositories/PrismaServiceRecordRepository';
import { PrismaCustomerRepository } from '../repositories/PrismaCustomerRepository';
import { PrismaSettingRepository } from '../repositories/PrismaSettingRepository';

export class PrismaTransactionManager implements ITransactionManager {
  constructor(private prisma: PrismaClient) {}

  async runInTransaction<T>(fn: (repos: TransactionalRepos) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        const repos: TransactionalRepos = {
          contractRepo: new PrismaContractRepository(tx as PrismaClient),
          invoiceRepo: new PrismaInvoiceRepository(tx as PrismaClient),
          paymentDayRepo: new PrismaPaymentDayRepository(tx as PrismaClient),
          auditRepo: new PrismaAuditLogRepository(tx as PrismaClient),
          savingTxRepo: new PrismaSavingTransactionRepository(tx as PrismaClient),
          serviceRecordRepo: new PrismaServiceRecordRepository(tx as PrismaClient),
          customerRepo: new PrismaCustomerRepository(tx as PrismaClient),
          settingRepo: new PrismaSettingRepository(tx as PrismaClient),
        };
        return fn(repos);
      },
      {
        timeout: 30000,
      },
    );
  }
}
