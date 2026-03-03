import {
  IBillingRepository,
  IContractRepository,
  IInvoiceRepository,
  IAuditLogRepository,
} from '../../domain/interfaces';
import { Billing, Invoice, Contract } from '../../domain/entities';
import {
  BillingStatus,
  ContractStatus,
  PaymentStatus,
  InvoiceType,
  AuditAction,
} from '../../domain/enums';
import { SettingService } from './SettingService';
import { v4 as uuidv4 } from 'uuid';

export class BillingService {
  private static billingCounter = 0;
  private static invoiceCounter = 0;

  constructor(
    private billingRepo: IBillingRepository,
    private contractRepo: IContractRepository,
    private invoiceRepo: IInvoiceRepository,
    private auditRepo: IAuditLogRepository,
    private settingService?: SettingService,
  ) {}

  private async getSetting(key: string, fallback: number): Promise<number> {
    if (!this.settingService) return fallback;
    return this.settingService.getNumberSetting(key, fallback);
  }

  /**
   * Check if a date is a Libur Bayar (holiday) for a contract.
   * - Every Sunday is a holiday
   * - Additional configurable holidays per month (tracked as days already used this month)
   */
  isHoliday(date: Date): boolean {
    // Sunday = 0
    return date.getDay() === 0;
  }

  /**
   * Count remaining configurable holiday days this month for a contract.
   * Returns the number of non-Sunday holidays already used this month from existing billings.
   */
  async getUsedHolidayDaysThisMonth(contractId: string, date: Date): Promise<number> {
    const billings = await this.billingRepo.findByContractId(contractId);
    const month = date.getMonth();
    const year = date.getFullYear();

    // Count billings marked as holiday (daysCount = 0, amount = 0) in this month that are NOT Sundays
    return billings.filter(b => {
      const bDate = b.periodStart;
      return bDate.getMonth() === month &&
        bDate.getFullYear() === year &&
        b.daysCount === 0 && // holiday billing
        bDate.getDay() !== 0; // not a Sunday (those are auto-holidays)
    }).length;
  }

  /**
   * Check if today should be a configurable holiday (Libur Bayar non-Minggu).
   * Each contract gets holidayDaysPerMonth configurable holidays per month.
   * These are spread evenly: every ~(30/holidayDaysPerMonth) days.
   */
  async shouldBeConfigurableHoliday(contract: Contract, date: Date): Promise<boolean> {
    const usedHolidays = await this.getUsedHolidayDaysThisMonth(contract.id, date);
    if (usedHolidays >= contract.holidayDaysPerMonth) return false;

    // Spread holidays evenly across the month
    // For 2 holidays/month: approximately every 15 days (day 8, day 22)
    // For 3 holidays/month: approximately every 10 days (day 7, day 14, day 21)
    // For 4 holidays/month: approximately every 7-8 days (day 6, day 12, day 18, day 24)
    const dayOfMonth = date.getDate();
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const interval = Math.floor(daysInMonth / (contract.holidayDaysPerMonth + 1));

    for (let i = 1; i <= contract.holidayDaysPerMonth; i++) {
      const holidayDay = interval * i;
      if (dayOfMonth === holidayDay) return true;
    }

    return false;
  }

  /**
   * Generate daily billing for all active contracts.
   * Called by the scheduler every day.
   * Returns the number of billings generated.
   */
  async generateDailyBilling(today?: Date): Promise<number> {
    const now = today || new Date();
    now.setHours(0, 0, 0, 0);

    const activeContracts = await this.contractRepo.findByStatus(ContractStatus.ACTIVE);
    let generated = 0;

    for (const contract of activeContracts) {
      // Skip if unit not received or billing hasn't started yet
      if (!contract.billingStartDate) continue;

      const billingStart = new Date(contract.billingStartDate);
      billingStart.setHours(0, 0, 0, 0);
      if (now < billingStart) continue;

      // Check if there's already an active billing for this contract
      const activeBilling = await this.billingRepo.findActiveByContractId(contract.id);
      if (activeBilling) {
        // Active billing exists — check if it needs rollover
        const periodEnd = new Date(activeBilling.periodEnd);
        periodEnd.setHours(23, 59, 59, 999);
        if (now > periodEnd) {
          // Billing period has passed, roll it over
          await this.rolloverBilling(activeBilling, contract, now);
          generated++;
        }
        // If still within period, skip (billing already active)
        continue;
      }

      // No active billing — check if today is a holiday
      const isSunday = this.isHoliday(now);
      const isConfigurableHoliday = !isSunday && await this.shouldBeConfigurableHoliday(contract, now);

      if (isSunday || isConfigurableHoliday) {
        // Create a holiday billing (zero amount, credits 1 day for free)
        await this.createHolidayBilling(contract, now);
        generated++;
        continue;
      }

      // Create a normal daily billing
      await this.createDailyBilling(contract, now);
      generated++;
    }

    return generated;
  }

  /**
   * Create a normal daily billing for 1 day.
   */
  private async createDailyBilling(contract: Contract, date: Date): Promise<Billing> {
    const periodStart = new Date(date);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(date);
    periodEnd.setHours(23, 59, 59, 999);

    const billing: Billing = {
      id: uuidv4(),
      billingNumber: this.generateBillingNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: contract.dailyRate,
      dailyRate: contract.dailyRate,
      daysCount: 1,
      status: BillingStatus.ACTIVE,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      periodStart,
      periodEnd,
      expiredAt: null,
      paidAt: null,
      invoiceId: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.billingRepo.create(billing);
  }

  /**
   * Create a holiday billing (zero amount, 0 daysCount).
   * Holiday days still count toward ownership but no payment required.
   */
  private async createHolidayBilling(contract: Contract, date: Date): Promise<Billing> {
    const periodStart = new Date(date);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(date);
    periodEnd.setHours(23, 59, 59, 999);

    const billing: Billing = {
      id: uuidv4(),
      billingNumber: this.generateBillingNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: 0,
      dailyRate: contract.dailyRate,
      daysCount: 0, // marker for holiday
      status: BillingStatus.PAID, // auto-completed, no payment needed
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      periodStart,
      periodEnd,
      expiredAt: null,
      paidAt: new Date(), // auto-paid
      invoiceId: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.billingRepo.create(billing);

    // Credit 1 free day to contract
    await this.creditDayToContract(contract, 1, true);

    return created;
  }

  /**
   * Rollover an expired billing: mark old as EXPIRED, create new billing with accumulated amount.
   */
  private async rolloverBilling(expiredBilling: Billing, contract: Contract, today: Date): Promise<Billing> {
    // Mark old billing as EXPIRED
    await this.billingRepo.update(expiredBilling.id, {
      status: BillingStatus.EXPIRED,
      expiredAt: new Date(),
    });

    // Check if today is a holiday
    const isSunday = this.isHoliday(today);
    const isConfigurableHoliday = !isSunday && await this.shouldBeConfigurableHoliday(contract, today);

    if (isSunday || isConfigurableHoliday) {
      // Holiday: credit 1 free day, create new billing with same accumulated amount (no additional charge)
      await this.creditDayToContract(contract, 1, true);

      const periodStart = new Date(today);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(today);
      periodEnd.setHours(23, 59, 59, 999);

      // Create holiday billing but carry forward the unpaid amount
      const newBilling: Billing = {
        id: uuidv4(),
        billingNumber: this.generateBillingNumber(),
        contractId: contract.id,
        customerId: contract.customerId,
        amount: expiredBilling.amount, // carry forward unpaid amount
        dailyRate: contract.dailyRate,
        daysCount: expiredBilling.daysCount, // same accumulated days
        status: BillingStatus.ACTIVE,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        periodStart,
        periodEnd,
        expiredAt: null,
        paidAt: null,
        invoiceId: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return this.billingRepo.create(newBilling);
    }

    // Normal day: add today's rate to accumulated amount
    const newAmount = expiredBilling.amount + contract.dailyRate;
    const newDaysCount = expiredBilling.daysCount + 1;

    const periodStart = new Date(today);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(today);
    periodEnd.setHours(23, 59, 59, 999);

    const newBilling: Billing = {
      id: uuidv4(),
      billingNumber: this.generateBillingNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: newAmount,
      dailyRate: contract.dailyRate,
      daysCount: newDaysCount,
      status: BillingStatus.ACTIVE,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      periodStart,
      periodEnd,
      expiredAt: null,
      paidAt: null,
      invoiceId: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.billingRepo.create(newBilling);
  }

  /**
   * Pay a billing: convert to invoice, credit days to contract.
   */
  async payBilling(billingId: string, adminId: string): Promise<{ billing: Billing; invoice: Invoice }> {
    const billing = await this.billingRepo.findById(billingId);
    if (!billing) throw new Error('Billing not found');

    if (billing.status === BillingStatus.PAID) {
      throw new Error('Billing already paid');
    }
    if (billing.status === BillingStatus.EXPIRED) {
      throw new Error('Billing has expired. A new billing should be active.');
    }
    if (billing.status === BillingStatus.CANCELLED) {
      throw new Error('Billing has been cancelled');
    }

    const contract = await this.contractRepo.findById(billing.contractId);
    if (!contract) throw new Error('Contract not found');

    // Create invoice from billing
    const invoiceNumber = this.generateInvoiceNumber();
    const invoice: Invoice = {
      id: uuidv4(),
      invoiceNumber,
      contractId: billing.contractId,
      customerId: billing.customerId,
      amount: billing.amount,
      lateFee: 0,
      type: InvoiceType.DAILY_BILLING,
      status: PaymentStatus.PAID,
      qrCodeData: `WEDISON-PAY-${invoiceNumber}-${billing.amount}`,
      dueDate: billing.periodEnd,
      paidAt: new Date(),
      extensionDays: billing.daysCount,
      dokuPaymentUrl: billing.dokuPaymentUrl,
      dokuReferenceId: billing.dokuReferenceId,
      billingPeriodStart: billing.periodStart,
      billingPeriodEnd: billing.periodEnd,
      billingId: billing.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdInvoice = await this.invoiceRepo.create(invoice);

    // Mark billing as paid
    const updatedBilling = await this.billingRepo.update(billingId, {
      status: BillingStatus.PAID,
      paidAt: new Date(),
      invoiceId: createdInvoice.id,
    });

    // Credit days to contract
    await this.creditDayToContract(contract, billing.daysCount, false);

    // Audit log
    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.PAYMENT,
      module: 'billing',
      entityId: billingId,
      description: `Billing ${billing.billingNumber} paid - ${billing.daysCount} days, Rp ${billing.amount.toLocaleString('id-ID')} → Invoice ${invoiceNumber}`,
      metadata: {
        billingNumber: billing.billingNumber,
        invoiceNumber,
        amount: billing.amount,
        daysCount: billing.daysCount,
        contractId: billing.contractId,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return { billing: updatedBilling!, invoice: createdInvoice };
  }

  /**
   * Credit days to a contract (update totalDaysPaid, ownershipProgress, endDate, etc.)
   */
  private async creditDayToContract(contract: Contract, days: number, isHoliday: boolean): Promise<void> {
    const newTotalDaysPaid = contract.totalDaysPaid + days;
    const newProgress = parseFloat(((newTotalDaysPaid / contract.ownershipTargetDays) * 100).toFixed(2));
    const isCompleted = newTotalDaysPaid >= contract.ownershipTargetDays;

    const newEndDate = new Date(contract.endDate);
    newEndDate.setDate(newEndDate.getDate() + days);

    const updateData: Partial<Contract> = {
      totalDaysPaid: newTotalDaysPaid,
      ownershipProgress: Math.min(newProgress, 100),
      endDate: newEndDate,
    };

    if (!isHoliday) {
      updateData.durationDays = contract.durationDays + days;
      updateData.totalAmount = contract.totalAmount + (contract.dailyRate * days);
    } else {
      // Holiday days don't add to durationDays (paid days) or totalAmount
      // but they DO count toward ownership (totalDaysPaid already updated above)
      updateData.durationDays = contract.durationDays + days;
    }

    if (isCompleted) {
      updateData.status = ContractStatus.COMPLETED;
      updateData.completedAt = new Date();
    }

    await this.contractRepo.update(contract.id, updateData);
  }

  /**
   * Get active billing for a contract.
   */
  async getActiveBillingByContractId(contractId: string): Promise<Billing | null> {
    return this.billingRepo.findActiveByContractId(contractId);
  }

  /**
   * Get all billings for a contract.
   */
  async getBillingsByContractId(contractId: string): Promise<Billing[]> {
    return this.billingRepo.findByContractId(contractId);
  }

  /**
   * Rollover all expired billings across all contracts.
   * Used by scheduler to catch up if server was down.
   */
  async rolloverExpiredBillings(today?: Date): Promise<number> {
    const now = today || new Date();
    now.setHours(0, 0, 0, 0);

    const activeBillings = await this.billingRepo.findByStatus(BillingStatus.ACTIVE);
    let rolledOver = 0;

    for (const billing of activeBillings) {
      const periodEnd = new Date(billing.periodEnd);
      periodEnd.setHours(23, 59, 59, 999);

      if (now > periodEnd) {
        const contract = await this.contractRepo.findById(billing.contractId);
        if (!contract) continue;
        if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.OVERDUE) continue;

        await this.rolloverBilling(billing, contract, now);
        rolledOver++;
      }
    }

    return rolledOver;
  }

  private generateBillingNumber(): string {
    BillingService.billingCounter++;
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const seq = BillingService.billingCounter.toString().padStart(4, '0');
    return `BIL-${y}${m}${d}-${seq}`;
  }

  private generateInvoiceNumber(): string {
    BillingService.invoiceCounter++;
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const seq = BillingService.invoiceCounter.toString().padStart(4, '0');
    return `INV-${y}${m}${d}-${seq}`;
  }
}
