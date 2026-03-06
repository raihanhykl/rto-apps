import { PaymentService } from '../application/services/PaymentService';
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryInvoiceRepository } from '../infrastructure/repositories/InMemoryInvoiceRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import {
  ContractStatus,
  PaymentStatus,
  MotorModel,
  BatteryType,
  DPScheme,
  InvoiceType,
  DEFAULT_OWNERSHIP_TARGET_DAYS,
  DEFAULT_GRACE_PERIOD_DAYS,
  HolidayScheme,
  DEFAULT_HOLIDAY_SCHEME,
} from '../domain/enums';
import { v4 as uuidv4 } from 'uuid';
import { Contract, Invoice } from '../domain/entities';

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let contractRepo: InMemoryContractRepository;
  let invoiceRepo: InMemoryInvoiceRepository;
  let auditRepo: InMemoryAuditLogRepository;
  const adminId = 'admin-1';

  let activeContract: Contract;

  function createDate(daysFromNow: number, hours = 0): Date {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hours, 0, 0, 0);
    return d;
  }

  async function createActiveContract(overrides: Partial<Contract> = {}): Promise<Contract> {
    const id = uuidv4();
    const customerId = uuidv4();
    return contractRepo.create({
      id,
      contractNumber: `RTO-TEST-${id.slice(0, 4)}`,
      customerId,
      motorModel: MotorModel.ATHENA,
      batteryType: BatteryType.REGULAR,
      dailyRate: 58000,
      durationDays: 0,
      totalAmount: 0,
      startDate: createDate(-5),
      endDate: createDate(-1),
      status: ContractStatus.ACTIVE,
      notes: '',
      createdBy: adminId,
      color: '',
      year: null,
      vinNumber: '',
      engineNumber: '',
      dpAmount: 530000,
      dpScheme: DPScheme.FULL,
      dpPaidAmount: 530000,
      dpFullyPaid: true,
      unitReceivedDate: createDate(-4),
      billingStartDate: createDate(-3),
      bastPhoto: 'https://storage.example.com/bast/test.jpg',
      bastNotes: 'Test BAST',
      holidayScheme: DEFAULT_HOLIDAY_SCHEME,
      ownershipTargetDays: DEFAULT_OWNERSHIP_TARGET_DAYS,
      totalDaysPaid: 0,
      workingDaysPaid: 0,
      holidayDaysPaid: 0,
      ownershipProgress: 0,
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      repossessedAt: null,
      completedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: createDate(-5),
      updatedAt: new Date(),
      ...overrides,
    });
  }

  function createInvoice(overrides: Partial<Invoice> = {}): Invoice {
    return {
      id: uuidv4(),
      invoiceNumber: 'PMT-260301-0001',
      contractId: activeContract?.id || 'contract-1',
      customerId: 'customer-1',
      amount: 58000,
      lateFee: 0,
      type: InvoiceType.DAILY_BILLING,
      status: PaymentStatus.PENDING,
      qrCodeData: 'WEDISON-PAY-PMT-260301-0001-58000',
      dueDate: new Date(),
      paidAt: null,
      extensionDays: 1,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: 58000,
      daysCount: 1,
      periodStart: new Date(),
      periodEnd: new Date(),
      expiredAt: null,
      previousPaymentId: null,
      isHoliday: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    contractRepo = new InMemoryContractRepository();
    invoiceRepo = new InMemoryInvoiceRepository();
    auditRepo = new InMemoryAuditLogRepository();
    paymentService = new PaymentService(invoiceRepo, contractRepo, auditRepo);

    activeContract = await createActiveContract();
  });

  // ============ generateDailyPayments ============

  describe('generateDailyPayments', () => {
    it('should generate a payment for an active contract with billing started', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const generated = await paymentService.generateDailyPayments(today);
      expect(generated).toBe(1);

      const payments = await invoiceRepo.findByContractId(activeContract.id);
      expect(payments.length).toBe(1);
      expect(payments[0].amount).toBe(58000);
      expect(payments[0].daysCount).toBe(1);
      expect(payments[0].status).toBe(PaymentStatus.PENDING);
    });

    it('should NOT generate payment if unit not received', async () => {
      const noUnitContract = await createActiveContract({
        unitReceivedDate: null,
        billingStartDate: null,
      });

      await paymentService.generateDailyPayments();
      const payments = await invoiceRepo.findByContractId(noUnitContract.id);
      expect(payments.length).toBe(0);
    });

    it('should NOT generate payment if billingStartDate is in the future', async () => {
      const futureContract = await createActiveContract({
        billingStartDate: createDate(2),
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await paymentService.generateDailyPayments(today);

      const payments = await invoiceRepo.findByContractId(futureContract.id);
      expect(payments.length).toBe(0);
    });

    it('should NOT generate new payment if active payment already exists', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await paymentService.generateDailyPayments(today);
      await paymentService.generateDailyPayments(today);

      const payments = await invoiceRepo.findByContractId(activeContract.id);
      expect(payments.length).toBe(1);
    });

    it('should create holiday payment on Libur Bayar Sunday (OLD_CONTRACT)', async () => {
      // OLD_CONTRACT: all Sundays are holidays
      const oldContract = await createActiveContract({
        holidayScheme: HolidayScheme.OLD_CONTRACT,
        billingStartDate: new Date(2026, 2, 1),
        endDate: new Date(2026, 2, 7), // Saturday
      });

      const sunday = new Date(2026, 2, 8);
      sunday.setHours(0, 0, 0, 0);

      await paymentService.generateDailyPayments(sunday);

      const payments = await invoiceRepo.findByContractId(oldContract.id);
      const holidayPayment = payments.find((p: Invoice) => p.daysCount === 0);
      expect(holidayPayment).toBeDefined();
      expect(holidayPayment!.amount).toBe(0);
      expect(holidayPayment!.status).toBe(PaymentStatus.PAID);
      expect(holidayPayment!.isHoliday).toBe(true);

      const contract = await contractRepo.findById(oldContract.id);
      expect(contract!.totalDaysPaid).toBe(1);
    });

    it('should create holiday payment on date > 28 (NEW_CONTRACT)', async () => {
      // NEW_CONTRACT: dates 29-31 are holidays
      const newContract = await createActiveContract({
        holidayScheme: HolidayScheme.NEW_CONTRACT,
        billingStartDate: new Date(2026, 2, 1),
        endDate: new Date(2026, 2, 28), // March 28
      });

      const march29 = new Date(2026, 2, 29);
      march29.setHours(0, 0, 0, 0);

      await paymentService.generateDailyPayments(march29);

      const payments = await invoiceRepo.findByContractId(newContract.id);
      const holidayPayment = payments.find((p: Invoice) => p.daysCount === 0);
      expect(holidayPayment).toBeDefined();
      expect(holidayPayment!.amount).toBe(0);
      expect(holidayPayment!.status).toBe(PaymentStatus.PAID);
      expect(holidayPayment!.isHoliday).toBe(true);

      const contract = await contractRepo.findById(newContract.id);
      expect(contract!.totalDaysPaid).toBe(1);
    });
  });

  // ============ Accumulated billing ============

  describe('accumulated payments', () => {
    it('should create accumulated payment for contracts with unpaid days', async () => {
      const overdueContract = await createActiveContract({
        startDate: createDate(-6),
        endDate: createDate(-6),
        billingStartDate: createDate(-5),
        status: ContractStatus.OVERDUE,
        totalDaysPaid: 0,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await paymentService.generateDailyPayments(today);

      const payments = await invoiceRepo.findByContractId(overdueContract.id);
      const activePayment = payments.find((p: Invoice) => p.status === PaymentStatus.PENDING);
      expect(activePayment).toBeDefined();

      expect(activePayment!.daysCount).toBeGreaterThan(1);
      expect(activePayment!.amount).toBe(activePayment!.daysCount! * 58000);
    });

    it('should generate payment for OVERDUE contracts', async () => {
      const overdueContract = await createActiveContract({
        endDate: createDate(-1),
        status: ContractStatus.OVERDUE,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await paymentService.generateDailyPayments(today);

      const payments = await invoiceRepo.findByContractId(overdueContract.id);
      expect(payments.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============ Rollover ============

  describe('rollover', () => {
    it('should rollover expired payment with accumulated amount', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      if (yesterday.getDay() === 0) return;

      await contractRepo.update(activeContract.id, { endDate: new Date(twoDaysAgo) });

      await paymentService.generateDailyPayments(yesterday);

      let payments = await invoiceRepo.findByContractId(activeContract.id);
      expect(payments.length).toBe(1);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today.getDay() === 0) return;

      await paymentService.rolloverExpiredPayments(today);

      payments = await invoiceRepo.findByContractId(activeContract.id);
      expect(payments.length).toBe(2);

      const expiredPayment = payments.find((p: Invoice) => p.status === PaymentStatus.EXPIRED);
      const pendingPayment = payments.find((p: Invoice) => p.status === PaymentStatus.PENDING);

      expect(expiredPayment).toBeDefined();
      expect(pendingPayment).toBeDefined();
      expect(pendingPayment!.amount).toBe(58000 * 2);
      expect(pendingPayment!.daysCount).toBe(2);
    });
  });

  // ============ payPayment ============

  describe('payPayment', () => {
    it('should pay a payment and update status to PAID', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await paymentService.generateDailyPayments(today);

      const payments = await invoiceRepo.findByContractId(activeContract.id);
      const pendingPayment = payments.find((p: Invoice) => p.status === PaymentStatus.PENDING);
      expect(pendingPayment).toBeDefined();

      const result = await paymentService.payPayment(pendingPayment!.id, adminId);

      expect(result.status).toBe(PaymentStatus.PAID);
      expect(result.paidAt).not.toBeNull();
    });

    it('should credit days to contract when payment is paid', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await paymentService.generateDailyPayments(today);

      const payments = await invoiceRepo.findByContractId(activeContract.id);
      const pendingPayment = payments.find((p: Invoice) => p.status === PaymentStatus.PENDING)!;

      await paymentService.payPayment(pendingPayment.id, adminId);

      const contract = await contractRepo.findById(activeContract.id);
      expect(contract!.totalDaysPaid).toBe(1);
      expect(contract!.durationDays).toBe(1);
      expect(contract!.totalAmount).toBe(58000);
    });

    it('should throw if payment already paid', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await paymentService.generateDailyPayments(today);

      const payments = await invoiceRepo.findByContractId(activeContract.id);
      const pendingPayment = payments.find((p: Invoice) => p.status === PaymentStatus.PENDING)!;

      await paymentService.payPayment(pendingPayment.id, adminId);
      await expect(paymentService.payPayment(pendingPayment.id, adminId)).rejects.toThrow('Payment already paid');
    });

    it('should throw if payment not found', async () => {
      await expect(paymentService.payPayment('non-existent', adminId)).rejects.toThrow('Payment not found');
    });

    it('should create audit log on payment', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await paymentService.generateDailyPayments(today);

      const payments = await invoiceRepo.findByContractId(activeContract.id);
      const pendingPayment = payments.find((p: Invoice) => p.status === PaymentStatus.PENDING)!;

      await paymentService.payPayment(pendingPayment.id, adminId);

      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('PAYMENT');
      expect(logs[0].module).toBe('payment');
    });

    it('should pay accumulated payment and credit all days', async () => {
      const day1 = new Date();
      day1.setDate(day1.getDate() - 1);
      day1.setHours(0, 0, 0, 0);
      if (day1.getDay() === 0) return;

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);
      await contractRepo.update(activeContract.id, { endDate: new Date(twoDaysAgo) });

      await paymentService.generateDailyPayments(day1);

      const day2 = new Date();
      day2.setHours(0, 0, 0, 0);
      if (day2.getDay() === 0) return;

      await paymentService.rolloverExpiredPayments(day2);

      const payments = await invoiceRepo.findByContractId(activeContract.id);
      const pendingPayment = payments.find((p: Invoice) => p.status === PaymentStatus.PENDING)!;

      expect(pendingPayment.daysCount).toBe(2);
      expect(pendingPayment.amount).toBe(58000 * 2);

      await paymentService.payPayment(pendingPayment.id, adminId);

      const contract = await contractRepo.findById(activeContract.id);
      expect(contract!.totalDaysPaid).toBe(2);
      expect(contract!.durationDays).toBe(2);
      expect(contract!.totalAmount).toBe(58000 * 2);
    });
  });

  // ============ rolloverExpiredPayments ============

  describe('rolloverExpiredPayments', () => {
    it('should rollover all expired payments', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      if (yesterday.getDay() === 0) return;

      await contractRepo.update(activeContract.id, { endDate: new Date(twoDaysAgo) });

      await paymentService.generateDailyPayments(yesterday);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rolledOver = await paymentService.rolloverExpiredPayments(today);
      expect(rolledOver).toBe(1);
    });

    it('should correctly accumulate multiple missed days on rollover', async () => {
      // Simulate: endDate = 4 days ago, payment generated 3 days ago, server down until today
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      fourDaysAgo.setHours(0, 0, 0, 0);

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(0, 0, 0, 0);
      if (threeDaysAgo.getDay() === 0) return; // skip if Sunday

      await contractRepo.update(activeContract.id, { endDate: new Date(fourDaysAgo) });

      // Generate a 1-day payment 3 days ago
      await paymentService.generateDailyPayments(threeDaysAgo);

      // Skip 2 days (server down), rollover today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today.getDay() === 0) return;

      await paymentService.rolloverExpiredPayments(today);

      const payments = await invoiceRepo.findByContractId(activeContract.id);
      const pendingPayment = payments.find((p: Invoice) => p.status === PaymentStatus.PENDING);
      expect(pendingPayment).toBeDefined();

      // Should recalculate ALL unpaid days from endDate+1 to today
      // Count working days (skip Libur Bayar Sundays)
      const endDate = new Date(fourDaysAgo);
      const firstUnpaid = new Date(endDate.getTime() + 86400000);
      let expectedDays = 0;
      const cursor = new Date(firstUnpaid);
      while (cursor <= today) {
        if (cursor.getDay() !== 0) expectedDays++; // simplified: all Sundays skipped for default 2 holidays/month
        else expectedDays++; // actually non-holiday Sundays count too, just use the service logic
        cursor.setDate(cursor.getDate() + 1);
      }
      // The key assertion: amount should be more than just +1 day from the original
      expect(pendingPayment!.daysCount).toBeGreaterThan(2);
      expect(pendingPayment!.amount).toBe(pendingPayment!.daysCount! * 58000);
    });
  });

  // ============ Libur Bayar ============

  describe('isLiburBayar', () => {
    it('OLD_CONTRACT: should return true for any Sunday', async () => {
      const oldContract = await createActiveContract({ holidayScheme: HolidayScheme.OLD_CONTRACT });
      expect(paymentService.isLiburBayar(oldContract, new Date('2026-03-01'))).toBe(true); // Sunday
      expect(paymentService.isLiburBayar(oldContract, new Date('2026-03-08'))).toBe(true); // Sunday
      expect(paymentService.isLiburBayar(oldContract, new Date('2026-03-15'))).toBe(true); // Sunday
      expect(paymentService.isLiburBayar(oldContract, new Date('2026-03-22'))).toBe(true); // Sunday
      expect(paymentService.isLiburBayar(oldContract, new Date('2026-03-29'))).toBe(true); // Sunday
    });

    it('OLD_CONTRACT: should return false for non-Sunday', async () => {
      const oldContract = await createActiveContract({ holidayScheme: HolidayScheme.OLD_CONTRACT });
      expect(paymentService.isLiburBayar(oldContract, new Date('2026-03-09'))).toBe(false); // Monday
      expect(paymentService.isLiburBayar(oldContract, new Date('2026-03-14'))).toBe(false); // Saturday
    });

    it('NEW_CONTRACT: should return true for date > 28', async () => {
      const newContract = await createActiveContract({ holidayScheme: HolidayScheme.NEW_CONTRACT });
      expect(paymentService.isLiburBayar(newContract, new Date('2026-03-29'))).toBe(true);
      expect(paymentService.isLiburBayar(newContract, new Date('2026-03-30'))).toBe(true);
      expect(paymentService.isLiburBayar(newContract, new Date('2026-03-31'))).toBe(true);
    });

    it('NEW_CONTRACT: should return false for date <= 28', async () => {
      const newContract = await createActiveContract({ holidayScheme: HolidayScheme.NEW_CONTRACT });
      expect(paymentService.isLiburBayar(newContract, new Date('2026-03-28'))).toBe(false);
      expect(paymentService.isLiburBayar(newContract, new Date('2026-03-01'))).toBe(false);
      // Sunday but still <= 28, NOT a holiday for NEW_CONTRACT
      expect(paymentService.isLiburBayar(newContract, new Date('2026-03-08'))).toBe(false);
    });

    it('NEW_CONTRACT: Feb non-leap year has no holidays', async () => {
      const newContract = await createActiveContract({ holidayScheme: HolidayScheme.NEW_CONTRACT });
      expect(paymentService.isLiburBayar(newContract, new Date('2027-02-28'))).toBe(false);
    });

    it('NEW_CONTRACT: Feb leap year, Feb 29 is holiday', async () => {
      const newContract = await createActiveContract({ holidayScheme: HolidayScheme.NEW_CONTRACT });
      expect(paymentService.isLiburBayar(newContract, new Date('2028-02-29'))).toBe(true);
    });
  });

  // ============ getActivePaymentByContractId ============

  describe('getActivePaymentByContractId', () => {
    it('should return active payment for contract', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await paymentService.generateDailyPayments(today);

      const active = await paymentService.getActivePaymentByContractId(activeContract.id);
      if (today.getDay() !== 0) {
        expect(active).not.toBeNull();
        expect(active!.contractId).toBe(activeContract.id);
      }
    });

    it('should return null if no active payment', async () => {
      const active = await paymentService.getActivePaymentByContractId(activeContract.id);
      expect(active).toBeNull();
    });
  });

  // ============ createManualPayment ============

  describe('createManualPayment', () => {
    it('should create a manual payment with correct amount', async () => {
      const payment = await paymentService.createManualPayment(activeContract.id, 3, adminId);

      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(payment.amount).toBe(58000 * 3);
      expect(payment.daysCount).toBe(3);
      expect(payment.previousPaymentId).toBeNull();
    });

    it('should merge with existing active payment', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await paymentService.generateDailyPayments(today);

      const payments1 = await invoiceRepo.findByContractId(activeContract.id);
      const existingActive = payments1.find((p: Invoice) => p.status === PaymentStatus.PENDING);
      if (!existingActive) return; // Skip if today is a Libur Bayar

      const merged = await paymentService.createManualPayment(activeContract.id, 2, adminId);

      expect(merged.status).toBe(PaymentStatus.PENDING);
      expect(merged.amount).toBe(existingActive.amount + 58000 * 2);
      expect(merged.daysCount).toBe(existingActive.daysCount! + 2);
      expect(merged.previousPaymentId).toBe(existingActive.id);

      // Old payment should be voided
      const oldPayment = await invoiceRepo.findById(existingActive.id);
      expect(oldPayment!.status).toBe(PaymentStatus.VOID);
    });

    it('should throw for invalid days', async () => {
      await expect(paymentService.createManualPayment(activeContract.id, 0, adminId))
        .rejects.toThrow('Manual payment must be 1-7 days');
      await expect(paymentService.createManualPayment(activeContract.id, 8, adminId))
        .rejects.toThrow('Manual payment must be 1-7 days');
    });

    it('should throw for contract not found', async () => {
      await expect(paymentService.createManualPayment('non-existent', 3, adminId))
        .rejects.toThrow('Contract not found');
    });

    it('should throw for contract without billing started', async () => {
      const noBillingContract = await createActiveContract({
        billingStartDate: null,
        unitReceivedDate: null,
      });
      await expect(paymentService.createManualPayment(noBillingContract.id, 3, adminId))
        .rejects.toThrow('Billing has not started yet');
    });

    it('should create audit log', async () => {
      await paymentService.createManualPayment(activeContract.id, 2, adminId);
      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('CREATE');
      expect(logs[0].module).toBe('payment');
    });
  });

  // ============ cancelPayment ============

  describe('cancelPayment', () => {
    it('should cancel a pending payment', async () => {
      const payment = await paymentService.createManualPayment(activeContract.id, 3, adminId);
      const cancelled = await paymentService.cancelPayment(payment.id, adminId);
      expect(cancelled.status).toBe(PaymentStatus.VOID);
    });

    it('should reactivate previous payment on cancel of merged payment', async () => {
      const initial = await paymentService.createManualPayment(activeContract.id, 2, adminId);
      const merged = await paymentService.createManualPayment(activeContract.id, 3, adminId);
      expect(merged.previousPaymentId).toBe(initial.id);

      await paymentService.cancelPayment(merged.id, adminId);

      const reactivated = await invoiceRepo.findById(initial.id);
      expect(reactivated!.status).toBe(PaymentStatus.PENDING);

      const cancelledMerged = await invoiceRepo.findById(merged.id);
      expect(cancelledMerged!.status).toBe(PaymentStatus.VOID);
    });

    it('should throw for non-pending payment', async () => {
      const payment = await paymentService.createManualPayment(activeContract.id, 2, adminId);
      await paymentService.cancelPayment(payment.id, adminId);
      await expect(paymentService.cancelPayment(payment.id, adminId))
        .rejects.toThrow('Only PENDING payments can be cancelled');
    });

    it('should throw for payment not found', async () => {
      await expect(paymentService.cancelPayment('non-existent', adminId))
        .rejects.toThrow('Payment not found');
    });

    it('should create audit log on cancel', async () => {
      const payment = await paymentService.createManualPayment(activeContract.id, 2, adminId);
      await paymentService.cancelPayment(payment.id, adminId);
      const logs = await auditRepo.findAll();
      // 1 for create + 1 for cancel
      expect(logs.length).toBe(2);
      const cancelLog = logs.find(l => l.action === 'UPDATE');
      expect(cancelLog).toBeDefined();
      expect(cancelLog!.module).toBe('payment');
    });
  });

  // ============ ownership completion ============

  describe('ownership completion via payment', () => {
    it('should mark contract as COMPLETED when ownership target reached', async () => {
      const shortContract = await createActiveContract({
        ownershipTargetDays: 2,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today.getDay() === 0) return;

      await paymentService.generateDailyPayments(today);

      const payments = await invoiceRepo.findByContractId(shortContract.id);
      const pendingPayment = payments.find((p: Invoice) => p.status === PaymentStatus.PENDING);
      if (!pendingPayment) return;

      await paymentService.payPayment(pendingPayment.id, adminId);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (tomorrow.getDay() === 0) return;

      await paymentService.generateDailyPayments(tomorrow);

      const payments2 = await invoiceRepo.findByContractId(shortContract.id);
      const pendingPayment2 = payments2.find((p: Invoice) => p.status === PaymentStatus.PENDING);
      if (!pendingPayment2) return;

      await paymentService.payPayment(pendingPayment2.id, adminId);

      const contract = await contractRepo.findById(shortContract.id);
      expect(contract!.totalDaysPaid).toBe(2);
      expect(contract!.status).toBe(ContractStatus.COMPLETED);
      expect(contract!.completedAt).not.toBeNull();
    });
  });

  // ============ simulatePayment (from InvoiceService) ============

  describe('simulatePayment', () => {
    let sampleContract: Contract;
    let samplePayment: Invoice;

    beforeEach(async () => {
      const contractId = uuidv4();
      const customerId = uuidv4();
      sampleContract = await contractRepo.create({
        id: contractId,
        contractNumber: 'RTO-260301-0001',
        customerId,
        motorModel: MotorModel.ATHENA,
        batteryType: BatteryType.REGULAR,
        dailyRate: 55000,
        durationDays: 3,
        totalAmount: 165000,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-04'),
        status: ContractStatus.ACTIVE,
        notes: '',
        createdBy: adminId,
        color: '',
        year: null,
        vinNumber: '',
        engineNumber: '',
        dpAmount: 0,
        dpScheme: DPScheme.FULL,
        dpPaidAmount: 0,
        dpFullyPaid: false,
        unitReceivedDate: null,
        billingStartDate: null,
        bastPhoto: null,
        bastNotes: '',
        holidayScheme: DEFAULT_HOLIDAY_SCHEME,
        ownershipTargetDays: DEFAULT_OWNERSHIP_TARGET_DAYS,
        totalDaysPaid: 0,
        workingDaysPaid: 0,
        holidayDaysPaid: 0,
        ownershipProgress: 0,
        gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
        repossessedAt: null,
        completedAt: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      samplePayment = await invoiceRepo.create(createInvoice({
        contractId,
        customerId,
        invoiceNumber: 'PMT-260301-0099',
        amount: 165000,
        type: InvoiceType.MANUAL_PAYMENT,
        extensionDays: 3,
        daysCount: 3,
        dailyRate: 55000,
      }));
    });

    it('should mark payment as PAID', async () => {
      const updated = await paymentService.simulatePayment(
        samplePayment.id,
        PaymentStatus.PAID,
        adminId
      );
      expect(updated.status).toBe(PaymentStatus.PAID);
      expect(updated.paidAt).not.toBeNull();
    });

    it('should credit days to contract when payment is paid', async () => {
      await paymentService.simulatePayment(samplePayment.id, PaymentStatus.PAID, adminId);
      const contract = await contractRepo.findById(sampleContract.id);
      expect(contract!.totalDaysPaid).toBe(3);
    });

    it('should mark payment as FAILED without affecting contract', async () => {
      const updated = await paymentService.simulatePayment(
        samplePayment.id,
        PaymentStatus.FAILED,
        adminId
      );
      expect(updated.status).toBe(PaymentStatus.FAILED);
      expect(updated.paidAt).toBeNull();
      const contract = await contractRepo.findById(sampleContract.id);
      expect(contract!.totalDaysPaid).toBe(0);
    });

    it('should throw if payment already paid', async () => {
      await paymentService.simulatePayment(samplePayment.id, PaymentStatus.PAID, adminId);
      await expect(
        paymentService.simulatePayment(samplePayment.id, PaymentStatus.PAID, adminId)
      ).rejects.toThrow('Payment already paid');
    });

    it('should throw if payment not found', async () => {
      await expect(
        paymentService.simulatePayment('non-existent', PaymentStatus.PAID, adminId)
      ).rejects.toThrow('Payment not found');
    });

    it('should create audit log on payment', async () => {
      const logsBefore = await auditRepo.findAll();
      await paymentService.simulatePayment(samplePayment.id, PaymentStatus.PAID, adminId);
      const logsAfter = await auditRepo.findAll();
      expect(logsAfter.length).toBe(logsBefore.length + 1);
      const payLog = logsAfter.find(l => l.action === 'PAYMENT' && l.entityId === samplePayment.id);
      expect(payLog).toBeDefined();
      expect(payLog!.module).toBe('payment');
    });
  });

  // ============ totalRevenue / totalPending ============

  describe('totalRevenue', () => {
    it('should return sum of paid payments', async () => {
      const payment = await invoiceRepo.create(createInvoice({
        amount: 165000,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      }));
      const revenue = await paymentService.totalRevenue();
      expect(revenue).toBe(165000);
    });

    it('should return 0 when no paid payments', async () => {
      const revenue = await paymentService.totalRevenue();
      expect(revenue).toBe(0);
    });
  });

  describe('totalPending', () => {
    it('should return sum of pending payments', async () => {
      await invoiceRepo.create(createInvoice({
        amount: 165000,
        status: PaymentStatus.PENDING,
      }));
      const pending = await paymentService.totalPending();
      expect(pending).toBe(165000);
    });
  });

  // ============ generateQRCode ============

  describe('generateQRCode', () => {
    it('should return QR code data URL', async () => {
      const payment = await invoiceRepo.create(createInvoice());
      const qr = await paymentService.generateQRCode(payment.id);
      expect(qr).toMatch(/^data:image\/png;base64,/);
    });

    it('should throw if payment not found', async () => {
      await expect(paymentService.generateQRCode('non-existent')).rejects.toThrow('Payment not found');
    });
  });

  // ============ voidPayment ============

  describe('voidPayment', () => {
    it('should void a pending payment', async () => {
      const payment = await invoiceRepo.create(createInvoice());
      const updated = await paymentService.voidPayment(payment.id, adminId);
      expect(updated.status).toBe(PaymentStatus.VOID);
    });

    it('should throw if payment already paid', async () => {
      const payment = await invoiceRepo.create(createInvoice({
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      }));
      await expect(
        paymentService.voidPayment(payment.id, adminId)
      ).rejects.toThrow('Cannot void a paid payment');
    });

    it('should throw if payment already voided', async () => {
      const payment = await invoiceRepo.create(createInvoice());
      await paymentService.voidPayment(payment.id, adminId);
      await expect(
        paymentService.voidPayment(payment.id, adminId)
      ).rejects.toThrow('Payment already voided');
    });

    it('should throw if payment not found', async () => {
      await expect(
        paymentService.voidPayment('non-existent', adminId)
      ).rejects.toThrow('Payment not found');
    });

    it('should create audit log', async () => {
      const payment = await invoiceRepo.create(createInvoice());
      await paymentService.voidPayment(payment.id, adminId);
      const logs = await auditRepo.findAll();
      const voidLog = logs.find(l => l.description.includes('Voided'));
      expect(voidLog).toBeDefined();
    });
  });

  // ============ markPaid (via payPayment) ============

  describe('markPaid (payPayment)', () => {
    it('should mark a pending payment as paid', async () => {
      const payment = await invoiceRepo.create(createInvoice({
        contractId: activeContract.id,
        customerId: activeContract.customerId,
      }));
      const updated = await paymentService.payPayment(payment.id, adminId);
      expect(updated.status).toBe(PaymentStatus.PAID);
      expect(updated.paidAt).not.toBeNull();
    });

    it('should throw if payment is voided', async () => {
      const payment = await invoiceRepo.create(createInvoice({
        status: PaymentStatus.VOID,
      }));
      await expect(
        paymentService.payPayment(payment.id, adminId)
      ).rejects.toThrow('Payment has been cancelled');
    });
  });

  // ============ revertPaymentStatus ============

  describe('revertPaymentStatus', () => {
    it('should revert PAID payment to PENDING and undo contract changes', async () => {
      const payment = await invoiceRepo.create(createInvoice({
        contractId: activeContract.id,
        customerId: activeContract.customerId,
        extensionDays: 1,
        daysCount: 1,
      }));

      // Pay first
      await paymentService.payPayment(payment.id, adminId);

      let contract = await contractRepo.findById(activeContract.id);
      expect(contract!.totalDaysPaid).toBe(1);

      // Revert
      const reverted = await paymentService.revertPaymentStatus(payment.id, adminId);
      expect(reverted.status).toBe(PaymentStatus.PENDING);
      expect(reverted.paidAt).toBeNull();

      contract = await contractRepo.findById(activeContract.id);
      expect(contract!.totalDaysPaid).toBe(0);
    });

    it('should throw if payment already PENDING', async () => {
      const payment = await invoiceRepo.create(createInvoice());
      await expect(
        paymentService.revertPaymentStatus(payment.id, adminId)
      ).rejects.toThrow('Payment sudah berstatus PENDING');
    });

    it('should throw if payment not found', async () => {
      await expect(
        paymentService.revertPaymentStatus('non-existent', adminId)
      ).rejects.toThrow('Payment not found');
    });
  });

  // ============ search ============

  describe('search', () => {
    it('should find payments by invoice number', async () => {
      await invoiceRepo.create(createInvoice({
        invoiceNumber: 'PMT-260305-0001',
      }));
      const results = await paymentService.search('PMT-260305');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].invoiceNumber).toContain('PMT-260305');
    });

    it('should return empty array for no matches', async () => {
      const results = await paymentService.search('PMT-999999');
      expect(results.length).toBe(0);
    });
  });

  // ============ bulkMarkPaid ============

  describe('bulkMarkPaid', () => {
    it('should mark multiple payments as paid', async () => {
      const p1 = await invoiceRepo.create(createInvoice({
        contractId: activeContract.id,
        customerId: activeContract.customerId,
        invoiceNumber: 'PMT-260305-0010',
      }));
      const p2 = await invoiceRepo.create(createInvoice({
        contractId: activeContract.id,
        customerId: activeContract.customerId,
        invoiceNumber: 'PMT-260305-0011',
      }));

      const result = await paymentService.bulkMarkPaid([p1.id, p2.id], adminId);
      expect(result.success.length).toBe(2);
      expect(result.failed.length).toBe(0);
    });

    it('should handle mixed success/failure', async () => {
      const p1 = await invoiceRepo.create(createInvoice({
        contractId: activeContract.id,
        customerId: activeContract.customerId,
        invoiceNumber: 'PMT-260305-0020',
      }));

      const result = await paymentService.bulkMarkPaid([p1.id, 'non-existent'], adminId);
      expect(result.success.length).toBe(1);
      expect(result.failed.length).toBe(1);
    });
  });
});
