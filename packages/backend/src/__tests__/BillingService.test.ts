import { BillingService } from '../application/services/BillingService';
import { InMemoryBillingRepository } from '../infrastructure/repositories/InMemoryBillingRepository';
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryInvoiceRepository } from '../infrastructure/repositories/InMemoryInvoiceRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import {
  BillingStatus,
  ContractStatus,
  PaymentStatus,
  MotorModel,
  BatteryType,
  DPScheme,
  InvoiceType,
  DEFAULT_OWNERSHIP_TARGET_DAYS,
  DEFAULT_GRACE_PERIOD_DAYS,
  DEFAULT_HOLIDAY_DAYS_PER_MONTH,
} from '../domain/enums';
import { v4 as uuidv4 } from 'uuid';
import { Contract } from '../domain/entities';

describe('BillingService', () => {
  let billingService: BillingService;
  let billingRepo: InMemoryBillingRepository;
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
      endDate: createDate(-1), // "covered" through yesterday — standard 1-day billing for today
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
      billingStartDate: createDate(-3), // billing started 3 days ago
      bastPhoto: 'https://storage.example.com/bast/test.jpg',
      bastNotes: 'Test BAST',
      holidayDaysPerMonth: DEFAULT_HOLIDAY_DAYS_PER_MONTH,
      ownershipTargetDays: DEFAULT_OWNERSHIP_TARGET_DAYS,
      totalDaysPaid: 0,
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

  beforeEach(async () => {
    billingRepo = new InMemoryBillingRepository();
    contractRepo = new InMemoryContractRepository();
    invoiceRepo = new InMemoryInvoiceRepository();
    auditRepo = new InMemoryAuditLogRepository();
    billingService = new BillingService(billingRepo, contractRepo, invoiceRepo, auditRepo);

    activeContract = await createActiveContract();
  });

  describe('generateDailyBilling', () => {
    it('should generate a billing for an active contract with billing started', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const generated = await billingService.generateDailyBilling(today);
      expect(generated).toBe(1);

      const billings = await billingRepo.findByContractId(activeContract.id);
      expect(billings.length).toBe(1);
      expect(billings[0].amount).toBe(58000);
      expect(billings[0].daysCount).toBe(1);
      expect(billings[0].status).toBe(BillingStatus.ACTIVE);
    });

    it('should NOT generate billing if unit not received', async () => {
      const noUnitContract = await createActiveContract({
        unitReceivedDate: null,
        billingStartDate: null,
      });

      const generated = await billingService.generateDailyBilling();
      // Only the activeContract gets billing, not noUnitContract
      const billings = await billingRepo.findByContractId(noUnitContract.id);
      expect(billings.length).toBe(0);
    });

    it('should NOT generate billing if billingStartDate is in the future', async () => {
      const futureContract = await createActiveContract({
        billingStartDate: createDate(2),
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await billingService.generateDailyBilling(today);

      const billings = await billingRepo.findByContractId(futureContract.id);
      expect(billings.length).toBe(0);
    });

    it('should NOT generate new billing if active billing already exists', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await billingService.generateDailyBilling(today);
      const gen2 = await billingService.generateDailyBilling(today);

      // Second call should not create duplicate
      const billings = await billingRepo.findByContractId(activeContract.id);
      expect(billings.length).toBe(1);
    });

    it('should create holiday billing on Libur Bayar Sunday', async () => {
      // March 8, 2026 (Sunday) is a designated Libur Bayar with 2 holidays/month
      const saturday = new Date(2026, 2, 7); // March 7, 2026 (Saturday)
      saturday.setHours(0, 0, 0, 0);
      const sunday = new Date(2026, 2, 8); // March 8, 2026 (Sunday, Libur Bayar)
      sunday.setHours(0, 0, 0, 0);

      // Set endDate to Saturday so firstUnpaidDay = Sunday (Libur Bayar)
      await contractRepo.update(activeContract.id, {
        endDate: new Date(saturday),
        billingStartDate: new Date(2026, 2, 1),
      });

      const generated = await billingService.generateDailyBilling(sunday);
      expect(generated).toBeGreaterThanOrEqual(1);

      const billings = await billingRepo.findByContractId(activeContract.id);
      const holidayBilling = billings.find(b => b.daysCount === 0);
      expect(holidayBilling).toBeDefined();
      expect(holidayBilling!.amount).toBe(0);
      expect(holidayBilling!.status).toBe(BillingStatus.PAID);
      // Holiday billing should be for Sunday March 8 (Libur Bayar)
      expect(new Date(holidayBilling!.periodStart).getDay()).toBe(0);

      // Contract should get 1 free day
      const contract = await contractRepo.findById(activeContract.id);
      expect(contract!.totalDaysPaid).toBe(1);
    });
  });

  describe('accumulated billing', () => {
    it('should create accumulated billing for contracts with unpaid days', async () => {
      // Contract with billing started 5 days ago, no days paid (endDate stays at startDate)
      const overdueContract = await createActiveContract({
        startDate: createDate(-6),
        endDate: createDate(-6), // no days paid yet
        billingStartDate: createDate(-5), // billing started 5 days ago
        status: ContractStatus.OVERDUE,
        totalDaysPaid: 0,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await billingService.generateDailyBilling(today);

      const billings = await billingRepo.findByContractId(overdueContract.id);
      const activeBilling = billings.find(b => b.status === BillingStatus.ACTIVE);
      expect(activeBilling).toBeDefined();

      // Should accumulate multiple days (past days up to today, minus Sundays)
      expect(activeBilling!.daysCount).toBeGreaterThan(1);
      expect(activeBilling!.amount).toBe(activeBilling!.daysCount * 58000);
    });

    it('should generate billing for OVERDUE contracts', async () => {
      const overdueContract = await createActiveContract({
        endDate: createDate(-1), // covered through yesterday
        status: ContractStatus.OVERDUE,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await billingService.generateDailyBilling(today);

      const billings = await billingRepo.findByContractId(overdueContract.id);
      expect(billings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('rollover', () => {
    it('should rollover expired billing with accumulated amount', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      if (yesterday.getDay() === 0) return; // skip if yesterday is Sunday

      // Set endDate to 2 days ago so from yesterday's perspective, firstUnpaidDay = yesterday
      await contractRepo.update(activeContract.id, { endDate: new Date(twoDaysAgo) });

      // Generate billing for yesterday — creates 1-day billing for yesterday
      await billingService.generateDailyBilling(yesterday);

      let billings = await billingRepo.findByContractId(activeContract.id);
      expect(billings.length).toBe(1);

      // Now rollover + generate for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Skip if today is Sunday (holiday)
      if (today.getDay() === 0) return;

      // Rollover first (as the scheduler does), then generate
      await billingService.rolloverExpiredBillings(today);

      billings = await billingRepo.findByContractId(activeContract.id);
      // Should have 2 billings: 1 expired + 1 new (rolled over)
      expect(billings.length).toBe(2);

      const expiredBilling = billings.find(b => b.status === BillingStatus.EXPIRED);
      const activeBilling = billings.find(b => b.status === BillingStatus.ACTIVE);

      expect(expiredBilling).toBeDefined();
      expect(activeBilling).toBeDefined();
      expect(activeBilling!.amount).toBe(58000 * 2); // accumulated
      expect(activeBilling!.daysCount).toBe(2);
    });
  });

  describe('payBilling', () => {
    it('should pay a billing and create invoice', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await billingService.generateDailyBilling(today);

      const billings = await billingRepo.findByContractId(activeContract.id);
      const activeBilling = billings.find(b => b.status === BillingStatus.ACTIVE);
      expect(activeBilling).toBeDefined();

      const result = await billingService.payBilling(activeBilling!.id, adminId);

      expect(result.billing.status).toBe(BillingStatus.PAID);
      expect(result.billing.paidAt).not.toBeNull();
      expect(result.invoice).toBeDefined();
      expect(result.invoice.type).toBe(InvoiceType.DAILY_BILLING);
      expect(result.invoice.status).toBe(PaymentStatus.PAID);
      expect(result.invoice.amount).toBe(58000);
      expect(result.invoice.extensionDays).toBe(1);
      expect(result.invoice.billingId).toBe(activeBilling!.id);
    });

    it('should credit days to contract when billing is paid', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await billingService.generateDailyBilling(today);

      const billings = await billingRepo.findByContractId(activeContract.id);
      const activeBilling = billings.find(b => b.status === BillingStatus.ACTIVE)!;

      await billingService.payBilling(activeBilling.id, adminId);

      const contract = await contractRepo.findById(activeContract.id);
      expect(contract!.totalDaysPaid).toBe(1);
      expect(contract!.durationDays).toBe(1);
      expect(contract!.totalAmount).toBe(58000);
    });

    it('should throw if billing already paid', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await billingService.generateDailyBilling(today);

      const billings = await billingRepo.findByContractId(activeContract.id);
      const activeBilling = billings.find(b => b.status === BillingStatus.ACTIVE)!;

      await billingService.payBilling(activeBilling.id, adminId);
      await expect(billingService.payBilling(activeBilling.id, adminId)).rejects.toThrow('Billing already paid');
    });

    it('should throw if billing not found', async () => {
      await expect(billingService.payBilling('non-existent', adminId)).rejects.toThrow('Billing not found');
    });

    it('should create audit log on payment', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await billingService.generateDailyBilling(today);

      const billings = await billingRepo.findByContractId(activeContract.id);
      const activeBilling = billings.find(b => b.status === BillingStatus.ACTIVE)!;

      await billingService.payBilling(activeBilling.id, adminId);

      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('PAYMENT');
      expect(logs[0].module).toBe('billing');
    });

    it('should pay accumulated billing and credit all days', async () => {
      // Day 1 (yesterday)
      const day1 = new Date();
      day1.setDate(day1.getDate() - 1);
      day1.setHours(0, 0, 0, 0);
      if (day1.getDay() === 0) return;

      // Set endDate to 2 days ago so firstUnpaidDay = yesterday
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);
      await contractRepo.update(activeContract.id, { endDate: new Date(twoDaysAgo) });

      await billingService.generateDailyBilling(day1);

      // Day 2 (today) — rollover via rolloverExpiredBillings (as scheduler does)
      const day2 = new Date();
      day2.setHours(0, 0, 0, 0);
      if (day2.getDay() === 0) return;

      await billingService.rolloverExpiredBillings(day2);

      const billings = await billingRepo.findByContractId(activeContract.id);
      const activeBilling = billings.find(b => b.status === BillingStatus.ACTIVE)!;

      expect(activeBilling.daysCount).toBe(2);
      expect(activeBilling.amount).toBe(58000 * 2);

      await billingService.payBilling(activeBilling.id, adminId);

      const contract = await contractRepo.findById(activeContract.id);
      expect(contract!.totalDaysPaid).toBe(2);
      expect(contract!.durationDays).toBe(2);
      expect(contract!.totalAmount).toBe(58000 * 2);
    });
  });

  describe('rolloverExpiredBillings', () => {
    it('should rollover all expired billings', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      if (yesterday.getDay() === 0) return; // skip Sunday

      // Set endDate to 2 days ago so billing for yesterday is standard 1-day
      await contractRepo.update(activeContract.id, { endDate: new Date(twoDaysAgo) });

      await billingService.generateDailyBilling(yesterday);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rolledOver = await billingService.rolloverExpiredBillings(today);
      expect(rolledOver).toBe(1);
    });
  });

  describe('getSundayHolidays', () => {
    it('should return correct number of holiday Sundays', () => {
      // March 2026 has Sundays on: 1, 8, 15, 22, 29 (5 Sundays)
      const holidays2 = billingService.getSundayHolidays(2026, 3, 2);
      expect(holidays2.size).toBe(2);

      const holidays4 = billingService.getSundayHolidays(2026, 3, 4);
      expect(holidays4.size).toBe(4);
    });

    it('should distribute holidays evenly', () => {
      // March 2026: Sundays are 1, 8, 15, 22, 29
      // With 2 holidays, should pick 2nd (8) and 4th (22) Sunday
      const holidays = billingService.getSundayHolidays(2026, 3, 2);
      expect(holidays.has(8)).toBe(true);
      expect(holidays.has(22)).toBe(true);
      expect(holidays.has(1)).toBe(false);
      expect(holidays.has(15)).toBe(false);
      expect(holidays.has(29)).toBe(false);
    });

    it('should cap at available Sundays', () => {
      // If holidayDaysPerMonth > number of Sundays, return all Sundays
      const holidays = billingService.getSundayHolidays(2026, 3, 10);
      expect(holidays.size).toBe(5); // only 5 Sundays in March 2026
    });
  });

  describe('isLiburBayar', () => {
    it('should return true for designated Libur Bayar Sunday', () => {
      // March 2026 with 2 holidays: Sundays 8 and 22
      const sunday8 = new Date('2026-03-08');
      expect(billingService.isLiburBayar(activeContract, sunday8)).toBe(true);
    });

    it('should return false for non-designated Sunday', () => {
      // Sunday March 1 is NOT a Libur Bayar with 2 holidays/month
      const sunday1 = new Date('2026-03-01');
      expect(billingService.isLiburBayar(activeContract, sunday1)).toBe(false);
    });

    it('should return false for non-Sunday', () => {
      const monday = new Date('2026-03-09');
      expect(billingService.isLiburBayar(activeContract, monday)).toBe(false);
    });
  });

  describe('getActiveBillingByContractId', () => {
    it('should return active billing for contract', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await billingService.generateDailyBilling(today);

      const active = await billingService.getActiveBillingByContractId(activeContract.id);
      // Active billing exists if today is not a holiday
      if (today.getDay() !== 0) {
        expect(active).not.toBeNull();
        expect(active!.contractId).toBe(activeContract.id);
      }
    });

    it('should return null if no active billing', async () => {
      const active = await billingService.getActiveBillingByContractId(activeContract.id);
      expect(active).toBeNull();
    });
  });

  describe('createManualBilling', () => {
    it('should create a manual billing with correct amount', async () => {
      const billing = await billingService.createManualBilling(activeContract.id, 3, adminId);

      expect(billing.status).toBe(BillingStatus.ACTIVE);
      expect(billing.amount).toBe(58000 * 3);
      expect(billing.daysCount).toBe(3);
      expect(billing.previousBillingId).toBeNull();
    });

    it('should merge with existing active billing', async () => {
      // Generate a daily billing first
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await billingService.generateDailyBilling(today);

      const billings1 = await billingRepo.findByContractId(activeContract.id);
      const existingActive = billings1.find(b => b.status === BillingStatus.ACTIVE);
      if (!existingActive) return; // Skip if today is a Libur Bayar

      // Create manual billing — should merge
      const merged = await billingService.createManualBilling(activeContract.id, 2, adminId);

      expect(merged.status).toBe(BillingStatus.ACTIVE);
      expect(merged.amount).toBe(existingActive.amount + 58000 * 2);
      expect(merged.daysCount).toBe(existingActive.daysCount + 2);
      expect(merged.previousBillingId).toBe(existingActive.id);

      // Old billing should be cancelled
      const oldBilling = await billingRepo.findById(existingActive.id);
      expect(oldBilling!.status).toBe(BillingStatus.CANCELLED);
    });

    it('should throw for invalid days', async () => {
      await expect(billingService.createManualBilling(activeContract.id, 0, adminId))
        .rejects.toThrow('Manual billing must be 1-7 days');
      await expect(billingService.createManualBilling(activeContract.id, 8, adminId))
        .rejects.toThrow('Manual billing must be 1-7 days');
    });

    it('should throw for contract not found', async () => {
      await expect(billingService.createManualBilling('non-existent', 3, adminId))
        .rejects.toThrow('Contract not found');
    });

    it('should throw for contract without billing started', async () => {
      const noBillingContract = await createActiveContract({
        billingStartDate: null,
        unitReceivedDate: null,
      });
      await expect(billingService.createManualBilling(noBillingContract.id, 3, adminId))
        .rejects.toThrow('Billing has not started yet');
    });

    it('should create audit log', async () => {
      await billingService.createManualBilling(activeContract.id, 2, adminId);
      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('CREATE');
      expect(logs[0].module).toBe('billing');
    });
  });

  describe('cancelBilling', () => {
    it('should cancel an active billing', async () => {
      const billing = await billingService.createManualBilling(activeContract.id, 3, adminId);
      const cancelled = await billingService.cancelBilling(billing.id, adminId);
      expect(cancelled.status).toBe(BillingStatus.CANCELLED);
    });

    it('should reactivate previous billing on cancel of merged billing', async () => {
      // Create initial manual billing
      const initial = await billingService.createManualBilling(activeContract.id, 2, adminId);

      // Create another manual billing — merges with initial
      const merged = await billingService.createManualBilling(activeContract.id, 3, adminId);
      expect(merged.previousBillingId).toBe(initial.id);

      // Cancel merged — should reactivate initial
      await billingService.cancelBilling(merged.id, adminId);

      const reactivated = await billingRepo.findById(initial.id);
      expect(reactivated!.status).toBe(BillingStatus.ACTIVE);

      const cancelledMerged = await billingRepo.findById(merged.id);
      expect(cancelledMerged!.status).toBe(BillingStatus.CANCELLED);
    });

    it('should throw for non-active billing', async () => {
      const billing = await billingService.createManualBilling(activeContract.id, 2, adminId);
      await billingService.cancelBilling(billing.id, adminId);
      await expect(billingService.cancelBilling(billing.id, adminId))
        .rejects.toThrow('Only ACTIVE billings can be cancelled');
    });

    it('should throw for billing not found', async () => {
      await expect(billingService.cancelBilling('non-existent', adminId))
        .rejects.toThrow('Billing not found');
    });

    it('should create audit log on cancel', async () => {
      const billing = await billingService.createManualBilling(activeContract.id, 2, adminId);
      await billingService.cancelBilling(billing.id, adminId);
      const logs = await auditRepo.findAll();
      // 1 for create + 1 for cancel
      expect(logs.length).toBe(2);
      const cancelLog = logs.find(l => l.action === 'UPDATE');
      expect(cancelLog).toBeDefined();
      expect(cancelLog!.module).toBe('billing');
    });
  });

  describe('ownership completion via billing', () => {
    it('should mark contract as COMPLETED when ownership target reached', async () => {
      // Create contract with very low target
      const shortContract = await createActiveContract({
        ownershipTargetDays: 2,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today.getDay() === 0) return; // skip Sunday

      await billingService.generateDailyBilling(today);

      // Pay the billing for the short contract
      const billings = await billingRepo.findByContractId(shortContract.id);
      const activeBilling = billings.find(b => b.status === BillingStatus.ACTIVE);
      if (!activeBilling) return;

      await billingService.payBilling(activeBilling.id, adminId);

      // Pay again the next day to reach 2 days
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (tomorrow.getDay() === 0) return; // skip Sunday

      // Need to rollover and generate new billing
      await billingService.generateDailyBilling(tomorrow);

      const billings2 = await billingRepo.findByContractId(shortContract.id);
      const activeBilling2 = billings2.find(b => b.status === BillingStatus.ACTIVE);
      if (!activeBilling2) return;

      await billingService.payBilling(activeBilling2.id, adminId);

      const contract = await contractRepo.findById(shortContract.id);
      expect(contract!.totalDaysPaid).toBe(2);
      expect(contract!.status).toBe(ContractStatus.COMPLETED);
      expect(contract!.completedAt).not.toBeNull();
    });
  });
});
