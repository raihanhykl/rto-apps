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
      endDate: createDate(-5),
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

    it('should create holiday billing on Sunday', async () => {
      // Find next Sunday
      const sunday = new Date();
      sunday.setHours(0, 0, 0, 0);
      while (sunday.getDay() !== 0) {
        sunday.setDate(sunday.getDate() + 1);
      }

      const generated = await billingService.generateDailyBilling(sunday);
      expect(generated).toBeGreaterThanOrEqual(1);

      const billings = await billingRepo.findByContractId(activeContract.id);
      const holidayBilling = billings.find(b => b.daysCount === 0);
      expect(holidayBilling).toBeDefined();
      expect(holidayBilling!.amount).toBe(0);
      expect(holidayBilling!.status).toBe(BillingStatus.PAID);

      // Contract should get 1 free day
      const contract = await contractRepo.findById(activeContract.id);
      expect(contract!.totalDaysPaid).toBe(1);
    });
  });

  describe('rollover', () => {
    it('should rollover expired billing with accumulated amount', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Generate billing for yesterday
      await billingService.generateDailyBilling(yesterday);

      let billings = await billingRepo.findByContractId(activeContract.id);
      expect(billings.length).toBe(1);
      const firstBilling = billings[0];

      // Now generate for today — should rollover the expired billing
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Skip if today is Sunday (holiday)
      if (today.getDay() === 0) {
        // Can't test rollover on Sunday, skip
        return;
      }

      await billingService.generateDailyBilling(today);

      billings = await billingRepo.findByContractId(activeContract.id);
      // Should have 2 billings: 1 expired + 1 new
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
      // Day 1
      const day1 = new Date();
      day1.setDate(day1.getDate() - 1);
      day1.setHours(0, 0, 0, 0);
      // Skip if day1 is Sunday
      if (day1.getDay() === 0) return;

      await billingService.generateDailyBilling(day1);

      // Day 2 (today) — rollover
      const day2 = new Date();
      day2.setHours(0, 0, 0, 0);
      // Skip if day2 is Sunday
      if (day2.getDay() === 0) return;

      await billingService.generateDailyBilling(day2);

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
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      if (yesterday.getDay() === 0) return; // skip Sunday

      await billingService.generateDailyBilling(yesterday);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rolledOver = await billingService.rolloverExpiredBillings(today);
      expect(rolledOver).toBe(1);
    });
  });

  describe('isHoliday', () => {
    it('should return true for Sunday', () => {
      const sunday = new Date('2026-03-08'); // A Sunday
      expect(billingService.isHoliday(sunday)).toBe(true);
    });

    it('should return false for Monday', () => {
      const monday = new Date('2026-03-09'); // A Monday
      expect(billingService.isHoliday(monday)).toBe(false);
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
