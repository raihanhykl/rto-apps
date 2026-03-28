import { ISavingTransactionRepository } from '../../domain/interfaces/ISavingTransactionRepository';
import { IContractRepository } from '../../domain/interfaces/IContractRepository';
import { IInvoiceRepository } from '../../domain/interfaces/IInvoiceRepository';
import { IAuditLogRepository } from '../../domain/interfaces/IAuditLogRepository';
import { ITransactionManager } from '../../domain/interfaces/ITransactionManager';
import { TransactionalRepos } from '../../domain/interfaces/ITransactionManager';
import { SavingTransaction } from '../../domain/entities/SavingTransaction';
import {
  SavingTransactionType,
  SAVING_PER_DAY,
  AuditAction,
  ContractStatus,
} from '../../domain/enums';
import { v4 as uuidv4 } from 'uuid';

interface DebitSavingInput {
  amount: number;
  description: string;
  photo?: string | null;
  notes?: string | null;
}

interface ClaimSavingInput {
  amount?: number;
  notes?: string | null;
}

export class SavingService {
  constructor(
    private savingTxRepo: ISavingTransactionRepository,
    private contractRepo: IContractRepository,
    private invoiceRepo: IInvoiceRepository,
    private auditRepo: IAuditLogRepository,
    private txManager?: ITransactionManager,
  ) {}

  /**
   * Auto-credit saving saat invoice harian dibayar.
   * amount = SAVING_PER_DAY × daysCount
   */
  async creditFromPayment(paymentId: string, adminId: string): Promise<SavingTransaction> {
    // READS outside transaction
    const invoice = await this.invoiceRepo.findById(paymentId);
    if (!invoice) throw new Error('Invoice not found');

    const contract = await this.contractRepo.findById(invoice.contractId);
    if (!contract) throw new Error('Contract not found');

    const daysCount = invoice.daysCount || 0;
    if (daysCount <= 0) throw new Error('Invalid daysCount for saving credit');

    const savingAmount = SAVING_PER_DAY * daysCount;
    const balanceBefore = contract.savingBalance;
    const balanceAfter = balanceBefore + savingAmount;

    const tx: SavingTransaction = {
      id: uuidv4(),
      contractId: contract.id,
      type: SavingTransactionType.CREDIT,
      amount: savingAmount,
      balanceBefore,
      balanceAfter,
      paymentId: invoice.id,
      daysCount,
      description: null,
      photo: null,
      partsReplaced: null,
      partsRepaired: null,
      createdBy: adminId,
      notes: null,
      createdAt: new Date(),
    };

    // WRITES inside transaction
    const writeOps = async (repos: TransactionalRepos) => {
      const created = await repos.savingTxRepo.create(tx);

      // Update denormalized balance
      await repos.contractRepo.update(contract.id, { savingBalance: balanceAfter });

      // Audit log
      await repos.auditRepo.create({
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.CREATE,
        module: 'saving',
        entityId: created.id,
        description: `Saving credit Rp ${savingAmount.toLocaleString('id-ID')} from ${invoice.invoiceNumber} (${daysCount} days × Rp ${SAVING_PER_DAY.toLocaleString('id-ID')})`,
        metadata: {
          type: 'CREDIT',
          amount: savingAmount,
          daysCount,
          paymentId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          balanceBefore,
          balanceAfter,
        },
        ipAddress: '',
        createdAt: new Date(),
      });

      return created;
    };

    if (this.txManager) {
      return this.txManager.runInTransaction(writeOps);
    } else {
      return writeOps({
        contractRepo: this.contractRepo,
        invoiceRepo: this.invoiceRepo,
        paymentDayRepo: null as any,
        auditRepo: this.auditRepo,
        savingTxRepo: this.savingTxRepo,
        serviceRecordRepo: null as any,
        customerRepo: null as any,
        settingRepo: null as any,
      });
    }
  }

  /**
   * Auto-reverse saving credit saat payment di-revert.
   * Return null jika tidak ada credit yang perlu di-reverse.
   */
  async reverseCreditFromPayment(
    paymentId: string,
    adminId: string,
  ): Promise<SavingTransaction | null> {
    // READS outside transaction
    const creditTxs = await this.savingTxRepo.findByPaymentId(paymentId);
    const creditTx = creditTxs.find((tx) => tx.type === SavingTransactionType.CREDIT);

    if (!creditTx) return null; // Tidak ada credit untuk invoice ini

    const contract = await this.contractRepo.findById(creditTx.contractId);
    if (!contract) throw new Error('Contract not found');

    const balanceBefore = contract.savingBalance;
    const balanceAfter = balanceBefore - creditTx.amount;

    // Guard: saldo tidak boleh negatif
    if (balanceAfter < 0) {
      throw new Error(
        `Insufficient saving balance for reversal. Current: Rp ${balanceBefore.toLocaleString('id-ID')}, reversal: Rp ${creditTx.amount.toLocaleString('id-ID')}`,
      );
    }

    const reversalTx: SavingTransaction = {
      id: uuidv4(),
      contractId: creditTx.contractId,
      type: SavingTransactionType.REVERSAL,
      amount: creditTx.amount,
      balanceBefore,
      balanceAfter,
      paymentId,
      daysCount: creditTx.daysCount,
      description: `Reversal of CREDIT from payment revert`,
      photo: null,
      partsReplaced: null,
      partsRepaired: null,
      createdBy: adminId,
      notes: null,
      createdAt: new Date(),
    };

    // WRITES inside transaction
    const writeOps = async (repos: TransactionalRepos) => {
      const created = await repos.savingTxRepo.create(reversalTx);

      // Atomic decrement — re-validates balance at DB level to prevent race conditions
      const updated = await repos.contractRepo.atomicDecrementSavingBalance(
        creditTx.contractId,
        creditTx.amount,
      );
      if (!updated) {
        throw new Error(
          `Insufficient saving balance for reversal (concurrent operation). Current balance may have changed.`,
        );
      }

      // Audit log
      await repos.auditRepo.create({
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.UPDATE,
        module: 'saving',
        entityId: created.id,
        description: `Saving reversal Rp ${creditTx.amount.toLocaleString('id-ID')} (payment revert)`,
        metadata: {
          type: 'REVERSAL',
          amount: creditTx.amount,
          originalCreditId: creditTx.id,
          paymentId,
          balanceBefore,
          balanceAfter,
        },
        ipAddress: '',
        createdAt: new Date(),
      });

      return created;
    };

    if (this.txManager) {
      return this.txManager.runInTransaction(writeOps);
    } else {
      return writeOps({
        contractRepo: this.contractRepo,
        invoiceRepo: this.invoiceRepo,
        paymentDayRepo: null as any,
        auditRepo: this.auditRepo,
        savingTxRepo: this.savingTxRepo,
        serviceRecordRepo: null as any,
        customerRepo: null as any,
        settingRepo: null as any,
      });
    }
  }

  /**
   * Debit saving untuk biaya service motor.
   * Validasi: contract exists, status ACTIVE/OVERDUE/COMPLETED, amount <= savingBalance.
   */
  async debitForService(
    contractId: string,
    dto: DebitSavingInput,
    adminId: string,
  ): Promise<SavingTransaction> {
    // READS outside transaction
    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    const allowedStatuses = [
      ContractStatus.ACTIVE,
      ContractStatus.OVERDUE,
      ContractStatus.COMPLETED,
    ];
    if (!allowedStatuses.includes(contract.status)) {
      throw new Error(`Saving tidak dapat digunakan pada kontrak berstatus ${contract.status}`);
    }

    if (dto.amount > contract.savingBalance) {
      throw new Error(
        `Saldo saving tidak cukup. Saldo: Rp ${contract.savingBalance.toLocaleString('id-ID')}, dibutuhkan: Rp ${dto.amount.toLocaleString('id-ID')}`,
      );
    }

    const balanceBefore = contract.savingBalance;
    const balanceAfter = balanceBefore - dto.amount;

    const tx: SavingTransaction = {
      id: uuidv4(),
      contractId,
      type: SavingTransactionType.DEBIT_SERVICE,
      amount: dto.amount,
      balanceBefore,
      balanceAfter,
      paymentId: null,
      daysCount: null,
      description: dto.description,
      photo: dto.photo || null,
      partsReplaced: null,
      partsRepaired: null,
      createdBy: adminId,
      notes: dto.notes || null,
      createdAt: new Date(),
    };

    // WRITES inside transaction
    const writeOps = async (repos: TransactionalRepos) => {
      const created = await repos.savingTxRepo.create(tx);

      // Atomic decrement — re-validates balance at DB level to prevent race conditions
      const updated = await repos.contractRepo.atomicDecrementSavingBalance(contractId, dto.amount);
      if (!updated) {
        throw new Error('Saldo tabungan berubah (concurrent operation). Silakan coba lagi.');
      }

      await repos.auditRepo.create({
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.UPDATE,
        module: 'saving',
        entityId: created.id,
        description: `Saving debit for service: Rp ${dto.amount.toLocaleString('id-ID')} — ${dto.description}`,
        metadata: {
          type: 'DEBIT_SERVICE',
          amount: dto.amount,
          description: dto.description,
          balanceBefore,
          balanceAfter,
        },
        ipAddress: '',
        createdAt: new Date(),
      });

      return created;
    };

    if (this.txManager) {
      return this.txManager.runInTransaction(writeOps);
    } else {
      return writeOps({
        contractRepo: this.contractRepo,
        invoiceRepo: this.invoiceRepo,
        paymentDayRepo: null as any,
        auditRepo: this.auditRepo,
        savingTxRepo: this.savingTxRepo,
        serviceRecordRepo: null as any,
        customerRepo: null as any,
        settingRepo: null as any,
      });
    }
  }

  /**
   * Debit saving untuk biaya balik nama STNK & BPKB.
   * Validasi: contract exists, status HARUS COMPLETED, amount <= savingBalance.
   */
  async debitForTransfer(
    contractId: string,
    dto: DebitSavingInput,
    adminId: string,
  ): Promise<SavingTransaction> {
    // READS outside transaction
    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    if (contract.status !== ContractStatus.COMPLETED) {
      throw new Error('Saving untuk balik nama hanya tersedia pada kontrak yang sudah COMPLETED');
    }

    if (dto.amount > contract.savingBalance) {
      throw new Error(
        `Saldo saving tidak cukup. Saldo: Rp ${contract.savingBalance.toLocaleString('id-ID')}, dibutuhkan: Rp ${dto.amount.toLocaleString('id-ID')}`,
      );
    }

    const balanceBefore = contract.savingBalance;
    const balanceAfter = balanceBefore - dto.amount;

    const tx: SavingTransaction = {
      id: uuidv4(),
      contractId,
      type: SavingTransactionType.DEBIT_TRANSFER,
      amount: dto.amount,
      balanceBefore,
      balanceAfter,
      paymentId: null,
      daysCount: null,
      description: dto.description,
      photo: dto.photo || null,
      partsReplaced: null,
      partsRepaired: null,
      createdBy: adminId,
      notes: dto.notes || null,
      createdAt: new Date(),
    };

    // WRITES inside transaction
    const writeOps = async (repos: TransactionalRepos) => {
      const created = await repos.savingTxRepo.create(tx);

      // Atomic decrement — re-validates balance at DB level to prevent race conditions
      const updated = await repos.contractRepo.atomicDecrementSavingBalance(contractId, dto.amount);
      if (!updated) {
        throw new Error('Saldo tabungan berubah (concurrent operation). Silakan coba lagi.');
      }

      await repos.auditRepo.create({
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.UPDATE,
        module: 'saving',
        entityId: created.id,
        description: `Saving debit for transfer: Rp ${dto.amount.toLocaleString('id-ID')} — ${dto.description}`,
        metadata: {
          type: 'DEBIT_TRANSFER',
          amount: dto.amount,
          description: dto.description,
          balanceBefore,
          balanceAfter,
        },
        ipAddress: '',
        createdAt: new Date(),
      });

      return created;
    };

    if (this.txManager) {
      return this.txManager.runInTransaction(writeOps);
    } else {
      return writeOps({
        contractRepo: this.contractRepo,
        invoiceRepo: this.invoiceRepo,
        paymentDayRepo: null as any,
        auditRepo: this.auditRepo,
        savingTxRepo: this.savingTxRepo,
        serviceRecordRepo: null as any,
        customerRepo: null as any,
        settingRepo: null as any,
      });
    }
  }

  /**
   * Claim sisa saving oleh customer.
   * Validasi: contract COMPLETED (bukan CANCELLED/REPOSSESSED), savingBalance > 0.
   * Jika dto.amount tidak diisi → claim semua sisa.
   */
  async claimSaving(
    contractId: string,
    dto: ClaimSavingInput,
    adminId: string,
  ): Promise<SavingTransaction> {
    // READS outside transaction
    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    if (contract.status !== ContractStatus.COMPLETED) {
      if (
        contract.status === ContractStatus.CANCELLED ||
        contract.status === ContractStatus.REPOSSESSED
      ) {
        throw new Error('Saving tidak dapat di-claim pada kontrak yang CANCELLED atau REPOSSESSED');
      }
      throw new Error('Saving hanya dapat di-claim pada kontrak yang sudah COMPLETED');
    }

    if (contract.savingBalance <= 0) {
      throw new Error('Saldo saving sudah habis');
    }

    const claimAmount = dto.amount || contract.savingBalance; // Default: claim semua
    if (claimAmount > contract.savingBalance) {
      throw new Error(
        `Saldo saving tidak cukup. Saldo: Rp ${contract.savingBalance.toLocaleString('id-ID')}, diminta: Rp ${claimAmount.toLocaleString('id-ID')}`,
      );
    }

    const balanceBefore = contract.savingBalance;
    const balanceAfter = balanceBefore - claimAmount;

    const tx: SavingTransaction = {
      id: uuidv4(),
      contractId,
      type: SavingTransactionType.DEBIT_CLAIM,
      amount: claimAmount,
      balanceBefore,
      balanceAfter,
      paymentId: null,
      daysCount: null,
      description: `Claim sisa saving oleh customer`,
      photo: null,
      partsReplaced: null,
      partsRepaired: null,
      createdBy: adminId,
      notes: dto.notes || null,
      createdAt: new Date(),
    };

    // WRITES inside transaction
    const writeOps = async (repos: TransactionalRepos) => {
      const created = await repos.savingTxRepo.create(tx);

      // Atomic decrement — re-validates balance at DB level to prevent race conditions
      const updated = await repos.contractRepo.atomicDecrementSavingBalance(
        contractId,
        claimAmount,
      );
      if (!updated) {
        throw new Error('Saldo tabungan berubah (concurrent operation). Silakan coba lagi.');
      }

      await repos.auditRepo.create({
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.UPDATE,
        module: 'saving',
        entityId: created.id,
        description: `Saving claim: Rp ${claimAmount.toLocaleString('id-ID')}`,
        metadata: {
          type: 'DEBIT_CLAIM',
          amount: claimAmount,
          balanceBefore,
          balanceAfter,
        },
        ipAddress: '',
        createdAt: new Date(),
      });

      return created;
    };

    if (this.txManager) {
      return this.txManager.runInTransaction(writeOps);
    } else {
      return writeOps({
        contractRepo: this.contractRepo,
        invoiceRepo: this.invoiceRepo,
        paymentDayRepo: null as any,
        auditRepo: this.auditRepo,
        savingTxRepo: this.savingTxRepo,
        serviceRecordRepo: null as any,
        customerRepo: null as any,
        settingRepo: null as any,
      });
    }
  }

  /**
   * Quick read saldo saving dari denormalized field.
   */
  async getBalance(contractId: string): Promise<number> {
    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');
    return contract.savingBalance;
  }

  /**
   * Ambil semua riwayat transaksi saving, ordered by createdAt DESC.
   */
  async getTransactionHistory(contractId: string): Promise<SavingTransaction[]> {
    return this.savingTxRepo.findByContractId(contractId);
  }

  async getTransactionsPaginated(
    contractId: string,
    page: number,
    limit: number,
  ): Promise<{ data: SavingTransaction[]; total: number }> {
    return this.savingTxRepo.findPaginatedByContractId(contractId, page, limit);
  }

  /**
   * Utility: recalculate savingBalance dari seluruh SavingTransaction.
   */
  async recalculateBalance(contractId: string, adminId: string): Promise<number> {
    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    const allTxs = await this.savingTxRepo.findByContractId(contractId);

    let calculatedBalance = 0;
    for (const tx of allTxs) {
      if (tx.type === SavingTransactionType.CREDIT) {
        calculatedBalance += tx.amount;
      } else {
        // DEBIT_SERVICE, DEBIT_TRANSFER, DEBIT_CLAIM, REVERSAL → semua mengurangi
        calculatedBalance -= tx.amount;
      }
    }

    // Ensure non-negative
    calculatedBalance = Math.max(0, calculatedBalance);

    if (calculatedBalance !== contract.savingBalance) {
      await this.contractRepo.update(contractId, { savingBalance: calculatedBalance });

      await this.auditRepo.create({
        id: uuidv4(),
        userId: adminId,
        action: AuditAction.UPDATE,
        module: 'saving',
        entityId: contractId,
        description: `Saving balance recalculated: Rp ${contract.savingBalance.toLocaleString('id-ID')} → Rp ${calculatedBalance.toLocaleString('id-ID')}`,
        metadata: {
          oldBalance: contract.savingBalance,
          newBalance: calculatedBalance,
          transactionCount: allTxs.length,
        },
        ipAddress: '',
        createdAt: new Date(),
      });
    }

    return calculatedBalance;
  }
}
