import { SavingService } from '../application/services/SavingService';
import { InMemorySavingTransactionRepository } from '../infrastructure/repositories/InMemorySavingTransactionRepository';
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryInvoiceRepository } from '../infrastructure/repositories/InMemoryInvoiceRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import {
  SavingTransactionType,
  SAVING_PER_DAY,
  ContractStatus,
  PaymentStatus,
  InvoiceType,
  DPScheme,
  HolidayScheme,
} from '../domain/enums';
import { Contract } from '../domain/entities/Contract';
import { Invoice } from '../domain/entities/Invoice';
import { v4 as uuidv4 } from 'uuid';

describe('SavingService', () => {
  let savingService: SavingService;
  let savingTxRepo: InMemorySavingTransactionRepository;
  let contractRepo: InMemoryContractRepository;
  let invoiceRepo: InMemoryInvoiceRepository;
  let auditRepo: InMemoryAuditLogRepository;

  // Helper: buat contract aktif dengan savingBalance tertentu
  async function createContract(overrides?: Partial<Contract>): Promise<Contract> {
    const contract: Contract = {
      id: uuidv4(),
      contractNumber: 'RTO-260310-0001',
      customerId: uuidv4(),
      motorModel: 'ATHENA' as any,
      batteryType: 'REGULAR' as any,
      dailyRate: 58000,
      durationDays: 0,
      totalAmount: 0,
      startDate: new Date(),
      endDate: new Date(),
      status: ContractStatus.ACTIVE,
      notes: '',
      createdBy: 'admin',
      color: '',
      year: null,
      vinNumber: '',
      engineNumber: '',
      dpAmount: 530000,
      dpScheme: 'FULL' as any,
      dpPaidAmount: 530000,
      dpFullyPaid: true,
      unitReceivedDate: new Date(),
      billingStartDate: new Date(),
      bastPhoto: null,
      bastNotes: '',
      holidayScheme: 'NEW_CONTRACT' as any,
      ownershipTargetDays: 1278,
      totalDaysPaid: 0,
      workingDaysPaid: 0,
      holidayDaysPaid: 0,
      ownershipProgress: 0,
      gracePeriodDays: 7,
      savingBalance: 0,
      repossessedAt: null,
      completedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    return contractRepo.create(contract);
  }

  // Helper: buat invoice daily billing PAID
  async function createPaidDailyInvoice(contractId: string, customerId: string, daysCount: number, overrides?: Partial<Invoice>): Promise<Invoice> {
    const invoice: Invoice = {
      id: uuidv4(),
      invoiceNumber: `PMT-260310-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
      contractId,
      customerId,
      amount: 58000 * daysCount,
      lateFee: 0,
      type: InvoiceType.DAILY_BILLING,
      status: PaymentStatus.PAID,
      qrCodeData: '',
      dueDate: new Date(),
      paidAt: new Date(),
      extensionDays: daysCount,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: 58000,
      daysCount,
      periodStart: new Date(),
      periodEnd: new Date(),
      expiredAt: null,
      previousPaymentId: null,
      isHoliday: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    return invoiceRepo.create(invoice);
  }

  beforeEach(() => {
    savingTxRepo = new InMemorySavingTransactionRepository();
    contractRepo = new InMemoryContractRepository();
    invoiceRepo = new InMemoryInvoiceRepository();
    auditRepo = new InMemoryAuditLogRepository();
    savingService = new SavingService(savingTxRepo, contractRepo, invoiceRepo, auditRepo);
  });

  // ============ CREDIT ============
  describe('creditFromPayment', () => {
    it('should credit saving when daily billing invoice is paid', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 5);

      const tx = await savingService.creditFromPayment(invoice.id, 'admin');

      expect(tx.type).toBe(SavingTransactionType.CREDIT);
      expect(tx.amount).toBe(SAVING_PER_DAY * 5);  // 5000 × 5 = 25000
      expect(tx.daysCount).toBe(5);
      expect(tx.balanceBefore).toBe(0);
      expect(tx.balanceAfter).toBe(25000);
      expect(tx.paymentId).toBe(invoice.id);

      // Verify contract.savingBalance updated
      const updated = await contractRepo.findById(contract.id);
      expect(updated!.savingBalance).toBe(25000);
    });

    it('should credit saving for manual payment', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 3, {
        type: InvoiceType.MANUAL_PAYMENT,
      });

      const tx = await savingService.creditFromPayment(invoice.id, 'admin');
      expect(tx.amount).toBe(SAVING_PER_DAY * 3);  // 5000 × 3 = 15000
    });

    it('should accumulate saving balance across multiple credits', async () => {
      const contract = await createContract();

      // Credit pertama: 5 hari
      const inv1 = await createPaidDailyInvoice(contract.id, contract.customerId, 5);
      await savingService.creditFromPayment(inv1.id, 'admin');

      // Credit kedua: 3 hari
      const inv2 = await createPaidDailyInvoice(contract.id, contract.customerId, 3);
      const tx2 = await savingService.creditFromPayment(inv2.id, 'admin');

      expect(tx2.balanceBefore).toBe(25000);  // dari credit pertama
      expect(tx2.balanceAfter).toBe(40000);   // 25000 + 15000

      const updated = await contractRepo.findById(contract.id);
      expect(updated!.savingBalance).toBe(40000);
    });

    it('should throw error for invoice with daysCount 0 or null', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 0);

      await expect(savingService.creditFromPayment(invoice.id, 'admin')).rejects.toThrow();
    });

    it('should create audit log for credit', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 2);

      await savingService.creditFromPayment(invoice.id, 'admin');

      const logs = await auditRepo.findRecent(10);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].module).toBe('saving');
    });
  });

  // ============ DEBIT SERVICE ============
  describe('debitForService', () => {
    it('should debit saving for motor service', async () => {
      const contract = await createContract({ savingBalance: 500000 });

      const tx = await savingService.debitForService(contract.id, {
        amount: 300000,
        description: 'Service rem depan + ganti kampas',
        photo: 'https://example.com/nota.jpg',
        notes: null,
      }, 'admin');

      expect(tx.type).toBe(SavingTransactionType.DEBIT_SERVICE);
      expect(tx.amount).toBe(300000);
      expect(tx.balanceBefore).toBe(500000);
      expect(tx.balanceAfter).toBe(200000);
      expect(tx.description).toBe('Service rem depan + ganti kampas');

      const updated = await contractRepo.findById(contract.id);
      expect(updated!.savingBalance).toBe(200000);
    });

    it('should throw error if amount exceeds saving balance', async () => {
      const contract = await createContract({ savingBalance: 100000 });

      await expect(savingService.debitForService(contract.id, {
        amount: 200000,
        description: 'Servis besar',
      }, 'admin')).rejects.toThrow('Saldo saving tidak cukup');
    });

    it('should throw error for contract not found', async () => {
      await expect(savingService.debitForService('nonexistent', {
        amount: 50000,
        description: 'Test',
      }, 'admin')).rejects.toThrow('Contract not found');
    });

    it('should allow debit on ACTIVE contract', async () => {
      const contract = await createContract({ status: ContractStatus.ACTIVE, savingBalance: 100000 });
      const tx = await savingService.debitForService(contract.id, { amount: 50000, description: 'Test' }, 'admin');
      expect(tx.balanceAfter).toBe(50000);
    });

    it('should allow debit on OVERDUE contract', async () => {
      const contract = await createContract({ status: ContractStatus.OVERDUE, savingBalance: 100000 });
      const tx = await savingService.debitForService(contract.id, { amount: 50000, description: 'Test' }, 'admin');
      expect(tx.balanceAfter).toBe(50000);
    });

    it('should allow debit on COMPLETED contract', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 100000 });
      const tx = await savingService.debitForService(contract.id, { amount: 50000, description: 'Test' }, 'admin');
      expect(tx.balanceAfter).toBe(50000);
    });

    it('should throw error on CANCELLED contract', async () => {
      const contract = await createContract({ status: ContractStatus.CANCELLED, savingBalance: 100000 });
      await expect(savingService.debitForService(contract.id, { amount: 50000, description: 'Test' }, 'admin'))
        .rejects.toThrow();
    });

    it('should throw error on REPOSSESSED contract', async () => {
      const contract = await createContract({ status: ContractStatus.REPOSSESSED, savingBalance: 100000 });
      await expect(savingService.debitForService(contract.id, { amount: 50000, description: 'Test' }, 'admin'))
        .rejects.toThrow();
    });
  });

  // ============ DEBIT TRANSFER ============
  describe('debitForTransfer', () => {
    it('should debit saving for STNK/BPKB transfer on COMPLETED contract', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 600000 });

      const tx = await savingService.debitForTransfer(contract.id, {
        amount: 400000,
        description: 'Biaya balik nama STNK + BPKB',
      }, 'admin');

      expect(tx.type).toBe(SavingTransactionType.DEBIT_TRANSFER);
      expect(tx.balanceAfter).toBe(200000);
    });

    it('should throw error on ACTIVE contract', async () => {
      const contract = await createContract({ status: ContractStatus.ACTIVE, savingBalance: 600000 });
      await expect(savingService.debitForTransfer(contract.id, { amount: 400000, description: 'Test' }, 'admin'))
        .rejects.toThrow('hanya tersedia pada kontrak yang sudah COMPLETED');
    });

    it('should throw error on OVERDUE contract', async () => {
      const contract = await createContract({ status: ContractStatus.OVERDUE, savingBalance: 600000 });
      await expect(savingService.debitForTransfer(contract.id, { amount: 400000, description: 'Test' }, 'admin'))
        .rejects.toThrow();
    });

    it('should throw error if amount exceeds balance', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 100000 });
      await expect(savingService.debitForTransfer(contract.id, { amount: 200000, description: 'Test' }, 'admin'))
        .rejects.toThrow('Saldo saving tidak cukup');
    });
  });

  // ============ CLAIM ============
  describe('claimSaving', () => {
    it('should claim full saving on COMPLETED contract', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 300000 });

      const tx = await savingService.claimSaving(contract.id, {}, 'admin');

      expect(tx.type).toBe(SavingTransactionType.DEBIT_CLAIM);
      expect(tx.amount).toBe(300000);
      expect(tx.balanceAfter).toBe(0);

      const updated = await contractRepo.findById(contract.id);
      expect(updated!.savingBalance).toBe(0);
    });

    it('should claim partial amount', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 300000 });

      const tx = await savingService.claimSaving(contract.id, { amount: 100000 }, 'admin');

      expect(tx.amount).toBe(100000);
      expect(tx.balanceAfter).toBe(200000);
    });

    it('should throw error on CANCELLED contract', async () => {
      const contract = await createContract({ status: ContractStatus.CANCELLED, savingBalance: 300000 });
      await expect(savingService.claimSaving(contract.id, {}, 'admin'))
        .rejects.toThrow('CANCELLED atau REPOSSESSED');
    });

    it('should throw error on REPOSSESSED contract', async () => {
      const contract = await createContract({ status: ContractStatus.REPOSSESSED, savingBalance: 300000 });
      await expect(savingService.claimSaving(contract.id, {}, 'admin'))
        .rejects.toThrow('CANCELLED atau REPOSSESSED');
    });

    it('should throw error on ACTIVE contract', async () => {
      const contract = await createContract({ status: ContractStatus.ACTIVE, savingBalance: 300000 });
      await expect(savingService.claimSaving(contract.id, {}, 'admin'))
        .rejects.toThrow('COMPLETED');
    });

    it('should throw error if saving balance is 0', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 0 });
      await expect(savingService.claimSaving(contract.id, {}, 'admin'))
        .rejects.toThrow('Saldo saving sudah habis');
    });

    it('should throw error if claim amount exceeds balance', async () => {
      const contract = await createContract({ status: ContractStatus.COMPLETED, savingBalance: 100000 });
      await expect(savingService.claimSaving(contract.id, { amount: 200000 }, 'admin'))
        .rejects.toThrow('Saldo saving tidak cukup');
    });
  });

  // ============ REVERSAL ============
  describe('reverseCreditFromPayment', () => {
    it('should reverse saving credit when payment reverted', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 5);

      // Credit dulu
      await savingService.creditFromPayment(invoice.id, 'admin');
      const afterCredit = await contractRepo.findById(contract.id);
      expect(afterCredit!.savingBalance).toBe(25000);

      // Reverse
      const reversalTx = await savingService.reverseCreditFromPayment(invoice.id, 'admin');

      expect(reversalTx).not.toBeNull();
      expect(reversalTx!.type).toBe(SavingTransactionType.REVERSAL);
      expect(reversalTx!.amount).toBe(25000);
      expect(reversalTx!.balanceAfter).toBe(0);

      const afterReversal = await contractRepo.findById(contract.id);
      expect(afterReversal!.savingBalance).toBe(0);
    });

    it('should return null if no credit exists for payment', async () => {
      const result = await savingService.reverseCreditFromPayment('nonexistent', 'admin');
      expect(result).toBeNull();
    });

    it('should throw error if reversal would make balance negative', async () => {
      const contract = await createContract();
      const invoice = await createPaidDailyInvoice(contract.id, contract.customerId, 10);

      // Credit: 50000
      await savingService.creditFromPayment(invoice.id, 'admin');

      // Debit some: 30000
      await savingService.debitForService(contract.id, {
        amount: 30000,
        description: 'Service',
      }, 'admin');

      // savingBalance = 20000, tapi reversal = 50000 → negatif!
      await expect(savingService.reverseCreditFromPayment(invoice.id, 'admin'))
        .rejects.toThrow('Insufficient saving balance');
    });
  });

  // ============ TRANSACTION HISTORY ============
  describe('getTransactionHistory', () => {
    it('should return transactions ordered by createdAt DESC', async () => {
      const contract = await createContract({ savingBalance: 500000 });

      // Buat beberapa transaksi
      const inv1 = await createPaidDailyInvoice(contract.id, contract.customerId, 2);
      await savingService.creditFromPayment(inv1.id, 'admin');

      await savingService.debitForService(contract.id, { amount: 5000, description: 'Service 1' }, 'admin');

      const history = await savingService.getTransactionHistory(contract.id);

      expect(history.length).toBe(2);
      // Terbaru di atas
      expect(history[0].createdAt.getTime()).toBeGreaterThanOrEqual(history[1].createdAt.getTime());
    });
  });

  // ============ RECALCULATE ============
  describe('recalculateBalance', () => {
    it('should recalculate balance from transactions', async () => {
      const contract = await createContract({ savingBalance: 999999 }); // intentionally wrong

      // Manually create transactions
      await savingTxRepo.create({
        id: uuidv4(),
        contractId: contract.id,
        type: SavingTransactionType.CREDIT,
        amount: 50000,
        balanceBefore: 0,
        balanceAfter: 50000,
        paymentId: null,
        daysCount: 10,
        description: null,
        photo: null,
        createdBy: 'admin',
        notes: null,
        createdAt: new Date(),
      });

      await savingTxRepo.create({
        id: uuidv4(),
        contractId: contract.id,
        type: SavingTransactionType.DEBIT_SERVICE,
        amount: 20000,
        balanceBefore: 50000,
        balanceAfter: 30000,
        paymentId: null,
        daysCount: null,
        description: 'Service',
        photo: null,
        createdBy: 'admin',
        notes: null,
        createdAt: new Date(),
      });

      const balance = await savingService.recalculateBalance(contract.id, 'admin');

      expect(balance).toBe(30000); // 50000 - 20000

      const updated = await contractRepo.findById(contract.id);
      expect(updated!.savingBalance).toBe(30000);
    });
  });

  // ============ FULL FLOW ============
  describe('Full Integration Flow', () => {
    it('should handle complete saving lifecycle', async () => {
      // 1. Buat kontrak aktif
      const contract = await createContract();

      // 2. Bayar 10 hari → saving = 50000
      const inv1 = await createPaidDailyInvoice(contract.id, contract.customerId, 10);
      await savingService.creditFromPayment(inv1.id, 'admin');

      let c = await contractRepo.findById(contract.id);
      expect(c!.savingBalance).toBe(50000);

      // 3. Service motor → saving = 20000
      await savingService.debitForService(contract.id, {
        amount: 30000,
        description: 'Ganti ban depan',
      }, 'admin');

      c = await contractRepo.findById(contract.id);
      expect(c!.savingBalance).toBe(20000);

      // 4. Bayar lagi 5 hari → saving = 45000
      const inv2 = await createPaidDailyInvoice(contract.id, contract.customerId, 5);
      await savingService.creditFromPayment(inv2.id, 'admin');

      c = await contractRepo.findById(contract.id);
      expect(c!.savingBalance).toBe(45000);

      // 5. Kontrak completed
      await contractRepo.update(contract.id, { status: ContractStatus.COMPLETED });

      // 6. Balik nama → saving = 25000
      await savingService.debitForTransfer(contract.id, {
        amount: 20000,
        description: 'Biaya balik nama STNK',
      }, 'admin');

      c = await contractRepo.findById(contract.id);
      expect(c!.savingBalance).toBe(25000);

      // 7. Claim sisa → saving = 0
      await savingService.claimSaving(contract.id, {}, 'admin');

      c = await contractRepo.findById(contract.id);
      expect(c!.savingBalance).toBe(0);

      // 8. Verifikasi riwayat lengkap
      const history = await savingService.getTransactionHistory(contract.id);
      expect(history.length).toBe(5); // 2 CREDIT + 1 DEBIT_SERVICE + 1 DEBIT_TRANSFER + 1 DEBIT_CLAIM
    });

    it('should handle revert → re-pay → revert cycle correctly', async () => {
      const contract = await createContract();

      // Pay 5 days → credit saving
      const inv = await createPaidDailyInvoice(contract.id, contract.customerId, 5);
      await savingService.creditFromPayment(inv.id, 'admin');
      expect((await contractRepo.findById(contract.id))!.savingBalance).toBe(25000);

      // Revert → reverse saving
      await savingService.reverseCreditFromPayment(inv.id, 'admin');
      expect((await contractRepo.findById(contract.id))!.savingBalance).toBe(0);

      // Pay again → credit saving again
      const inv2 = await createPaidDailyInvoice(contract.id, contract.customerId, 5);
      await savingService.creditFromPayment(inv2.id, 'admin');
      expect((await contractRepo.findById(contract.id))!.savingBalance).toBe(25000);

      // Revert again → reverse saving again
      await savingService.reverseCreditFromPayment(inv2.id, 'admin');
      expect((await contractRepo.findById(contract.id))!.savingBalance).toBe(0);
    });
  });
});
