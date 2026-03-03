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

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  status: 'paid' | 'pending' | 'overdue' | 'holiday' | 'not_issued';
  amount?: number;
}

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
   * Get the designated Libur Bayar Sundays for a given month.
   * Returns a Set of day-of-month numbers that are Libur Bayar.
   * Picks `holidayDaysPerMonth` Sundays evenly distributed across the month.
   * @param year - full year (e.g., 2026)
   * @param month - 1-based month (1=January)
   * @param holidayDaysPerMonth - number of Sundays to designate as holidays
   */
  getSundayHolidays(year: number, month: number, holidayDaysPerMonth: number): Set<number> {
    const sundays: number[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month - 1, d).getDay() === 0) {
        sundays.push(d);
      }
    }

    const N = sundays.length;
    const K = Math.min(holidayDaysPerMonth, N);

    const result = new Set<number>();
    for (let i = 0; i < K; i++) {
      const idx = Math.floor(i * N / K + N / (2 * K));
      result.add(sundays[idx]);
    }

    return result;
  }

  /**
   * Check if a date is a designated Libur Bayar for a contract.
   * Only certain Sundays (based on holidayDaysPerMonth) are Libur Bayar.
   * Not all Sundays are holidays.
   */
  isLiburBayar(contract: Contract, date: Date): boolean {
    if (date.getDay() !== 0) return false;
    const holidays = this.getSundayHolidays(
      date.getFullYear(),
      date.getMonth() + 1,
      contract.holidayDaysPerMonth,
    );
    return holidays.has(date.getDate());
  }

  /**
   * Generate daily billing for all active/overdue contracts (PREPAID model).
   * Billing generated today covers TOMORROW's usage.
   * For contracts with unpaid days, creates accumulated billing covering all missed days.
   * Called by the scheduler every day.
   */
  async generateDailyBilling(today?: Date): Promise<number> {
    const now = today || new Date();
    now.setHours(0, 0, 0, 0);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Process both ACTIVE and OVERDUE contracts
    const activeContracts = await this.contractRepo.findByStatus(ContractStatus.ACTIVE);
    const overdueContracts = await this.contractRepo.findByStatus(ContractStatus.OVERDUE);
    const contracts = [...activeContracts, ...overdueContracts];
    let generated = 0;

    for (const contract of contracts) {
      // Skip if unit not received or billing hasn't started yet
      if (!contract.billingStartDate) continue;

      const billingStart = new Date(contract.billingStartDate);
      billingStart.setHours(0, 0, 0, 0);

      // Only generate if tomorrow >= billingStartDate (prepaid: generate today for tomorrow's usage)
      if (tomorrow < billingStart) continue;

      // Check if there's already an active billing for this contract
      const activeBilling = await this.billingRepo.findActiveByContractId(contract.id);
      if (activeBilling) {
        // Active billing exists — rollover is handled by rolloverExpiredBillings()
        continue;
      }

      // No active billing — determine the first unpaid day
      const endDate = new Date(contract.endDate);
      endDate.setHours(0, 0, 0, 0);

      // First unpaid day: endDate + 1, but at least billingStartDate
      const firstUnpaidDay = new Date(Math.max(endDate.getTime() + 86400000, billingStart.getTime()));
      firstUnpaidDay.setHours(0, 0, 0, 0);

      // Contract is paid in advance — no billing needed
      if (firstUnpaidDay > tomorrow) continue;

      if (firstUnpaidDay <= now) {
        // There are unpaid days from today or the past — create accumulated billing
        let unpaidWorkingDays = 0;
        const cursor = new Date(firstUnpaidDay);
        while (cursor <= tomorrow) {
          if (!this.isLiburBayar(contract, cursor)) {
            unpaidWorkingDays++;
          }
          cursor.setDate(cursor.getDate() + 1);
        }

        if (unpaidWorkingDays > 0) {
          const periodStart = new Date(firstUnpaidDay);
          periodStart.setHours(0, 0, 0, 0);
          const periodEnd = new Date(tomorrow);
          periodEnd.setHours(23, 59, 59, 999);

          const billing: Billing = {
            id: uuidv4(),
            billingNumber: this.generateBillingNumber(),
            contractId: contract.id,
            customerId: contract.customerId,
            amount: unpaidWorkingDays * contract.dailyRate,
            dailyRate: contract.dailyRate,
            daysCount: unpaidWorkingDays,
            status: BillingStatus.ACTIVE,
            dokuPaymentUrl: null,
            dokuReferenceId: null,
            periodStart,
            periodEnd,
            expiredAt: null,
            paidAt: null,
            invoiceId: null,
            previousBillingId: null,
            isDeleted: false,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await this.billingRepo.create(billing);
          generated++;
        }
        continue;
      }

      // firstUnpaidDay === tomorrow (standard case)
      // Check if tomorrow is a Libur Bayar
      if (this.isLiburBayar(contract, tomorrow)) {
        // Create a holiday billing for tomorrow (zero amount, credits 1 day for free)
        await this.createHolidayBilling(contract, tomorrow);
        generated++;
        continue;
      }

      // Create a normal daily billing for tomorrow
      await this.createDailyBilling(contract, tomorrow);
      generated++;
    }

    return generated;
  }

  /**
   * Create a normal daily billing (PREPAID: covers the target usage day).
   */
  private async createDailyBilling(contract: Contract, usageDate: Date): Promise<Billing> {
    const periodStart = new Date(usageDate);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(usageDate);
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
      previousBillingId: null,
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
  private async createHolidayBilling(contract: Contract, targetDate: Date): Promise<Billing> {
    const periodStart = new Date(targetDate);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(targetDate);
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
      previousBillingId: null,
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
   * Rollover an expired billing (PREPAID model):
   * - Mark old as EXPIRED
   * - Create new billing covering tomorrow + accumulated unpaid days
   * - periodStart keeps the earliest unpaid day, periodEnd = tomorrow
   */
  private async rolloverBilling(expiredBilling: Billing, contract: Contract, today: Date): Promise<Billing> {
    // Mark old billing as EXPIRED
    await this.billingRepo.update(expiredBilling.id, {
      status: BillingStatus.EXPIRED,
      expiredAt: new Date(),
    });

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Check if tomorrow is a Libur Bayar
    if (this.isLiburBayar(contract, tomorrow)) {
      // Holiday: credit 1 free day, carry forward the unpaid amount
      await this.creditDayToContract(contract, 1, true);

      const periodEnd = new Date(tomorrow);
      periodEnd.setHours(23, 59, 59, 999);

      const newBilling: Billing = {
        id: uuidv4(),
        billingNumber: this.generateBillingNumber(),
        contractId: contract.id,
        customerId: contract.customerId,
        amount: expiredBilling.amount, // carry forward unpaid amount
        dailyRate: contract.dailyRate,
        daysCount: expiredBilling.daysCount, // same accumulated unpaid days
        status: BillingStatus.ACTIVE,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        periodStart: expiredBilling.periodStart, // keep earliest unpaid day
        periodEnd,
        expiredAt: null,
        paidAt: null,
        invoiceId: null,
        previousBillingId: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return this.billingRepo.create(newBilling);
    }

    // Normal day: add tomorrow's rate to accumulated amount
    const newAmount = expiredBilling.amount + contract.dailyRate;
    const newDaysCount = expiredBilling.daysCount + 1;

    const periodEnd = new Date(tomorrow);
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
      periodStart: expiredBilling.periodStart, // keep earliest unpaid day
      periodEnd,
      expiredAt: null,
      paidAt: null,
      invoiceId: null,
      previousBillingId: null,
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

    // Advance endDate by working days, skipping Sundays
    const newEndDate = new Date(contract.endDate);
    if (isHoliday) {
      // Holiday credit: advance by 1 calendar day (the holiday itself)
      newEndDate.setDate(newEndDate.getDate() + days);
    } else {
      // Working day credit: advance day by day, skipping Libur Bayar Sundays
      let remaining = days;
      while (remaining > 0) {
        newEndDate.setDate(newEndDate.getDate() + 1);
        if (!this.isLiburBayar(contract, newEndDate)) {
          remaining--;
        }
      }
    }

    const updateData: Partial<Contract> = {
      totalDaysPaid: newTotalDaysPaid,
      ownershipProgress: Math.min(newProgress, 100),
      endDate: newEndDate,
    };

    if (!isHoliday) {
      updateData.durationDays = contract.durationDays + days;
      updateData.totalAmount = contract.totalAmount + (contract.dailyRate * days);
    } else {
      // Holiday days don't add to totalAmount but DO count toward ownership (totalDaysPaid)
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
   * Get calendar data for a contract — one entry per day in the month.
   * Status: 'paid' | 'pending' | 'overdue' | 'holiday' | 'not_issued'
   */
  async getCalendarData(contractId: string, year: number, month: number): Promise<CalendarDay[]> {
    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    const billings = await this.billingRepo.findByContractId(contractId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysInMonth = new Date(year, month, 0).getDate();
    const result: CalendarDay[] = [];

    // Determine billing start date
    const billingStart = contract.billingStartDate ? new Date(contract.billingStartDate) : null;
    if (billingStart) billingStart.setHours(0, 0, 0, 0);

    // Collect holiday dates from holiday billings (daysCount=0, PAID)
    const holidayDates = new Set<string>();
    billings.filter(b => b.daysCount === 0 && b.status === BillingStatus.PAID).forEach(b => {
      const d = new Date(b.periodStart);
      holidayDates.add(toDateKey(d));
    });

    // Use contract.endDate as the coverage boundary.
    // endDate is maintained by creditDayToContract() which skips Sundays,
    // so it accurately represents the last calendar day covered by payments.
    let coveredEndDate: Date | null = null;
    if (billingStart && contract.totalDaysPaid > 0) {
      coveredEndDate = new Date(contract.endDate);
      coveredEndDate.setHours(0, 0, 0, 0);
    }

    // Find active billing
    const activeBilling = billings.find(b => b.status === BillingStatus.ACTIVE);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      date.setHours(0, 0, 0, 0);
      const dateKey = toDateKey(date);

      // Before billing start or no billing start yet
      if (!billingStart || date < billingStart) {
        result.push({ date: dateKey, status: 'not_issued' });
        continue;
      }

      // Within covered period (paid or holiday)
      if (coveredEndDate && date <= coveredEndDate) {
        if (this.isLiburBayar(contract, date) || holidayDates.has(dateKey)) {
          result.push({ date: dateKey, status: 'holiday' });
        } else {
          result.push({ date: dateKey, status: 'paid' });
        }
        continue;
      }

      // Active billing covers this day
      // Distinguish between: past dates (overdue/red) vs today/future (pending/yellow)
      if (activeBilling) {
        const activeStart = new Date(activeBilling.periodStart);
        activeStart.setHours(0, 0, 0, 0);
        const activeEnd = new Date(activeBilling.periodEnd);
        activeEnd.setHours(0, 0, 0, 0);

        const isInBillingPeriod = date >= activeStart && date <= activeEnd;
        const isToday = date.getTime() === today.getTime();

        if (isInBillingPeriod || isToday) {
          if (this.isLiburBayar(contract, date)) {
            // Libur Bayar Sundays within billing period are holidays
            result.push({ date: dateKey, status: 'holiday' });
          } else if (date < today) {
            // Past dates within active billing = overdue (accumulated/rollover days not yet paid)
            result.push({ date: dateKey, status: 'overdue', amount: activeBilling.amount });
          } else {
            // Today or future = pending (billing issued, awaiting payment)
            result.push({ date: dateKey, status: 'pending', amount: activeBilling.amount });
          }
          continue;
        }
      }

      // Libur Bayar Sunday (future or past, not yet billed)
      if (this.isLiburBayar(contract, date)) {
        result.push({ date: dateKey, status: 'holiday' });
        continue;
      }

      // Past due day (before today, not paid, not holiday)
      if (date < today) {
        result.push({ date: dateKey, status: 'overdue' });
        continue;
      }

      // Future (not yet issued)
      result.push({ date: dateKey, status: 'not_issued' });
    }

    return result;
  }

  /**
   * Create a manual billing for a contract (admin "Bayar Tagihan" for 1-7 days).
   * - If no active billing: creates new ACTIVE billing for N days
   * - If active billing exists: cancels old, creates merged billing (old + new amounts)
   * - Merged billing stores previousBillingId for cancel/revert
   */
  async createManualBilling(contractId: string, days: number, adminId: string): Promise<Billing> {
    if (days < 1 || days > 7) throw new Error('Manual billing must be 1-7 days');

    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');
    if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.OVERDUE) {
      throw new Error('Contract must be ACTIVE or OVERDUE');
    }
    if (!contract.billingStartDate) throw new Error('Billing has not started yet');

    const amount = days * contract.dailyRate;

    // Calculate period from contract.endDate forward
    const periodStart = new Date(contract.endDate);
    periodStart.setDate(periodStart.getDate() + 1);
    periodStart.setHours(0, 0, 0, 0);

    // Advance by N working days (skipping Libur Bayar) to find periodEnd
    let workingDaysToAdvance = days;
    const periodEnd = new Date(periodStart);
    // We need the period to cover `days` working days starting from periodStart
    // But periodStart itself might be a Libur Bayar
    let remaining = workingDaysToAdvance;
    const cursor = new Date(periodStart);
    while (remaining > 0) {
      if (!this.isLiburBayar(contract, cursor)) {
        remaining--;
        if (remaining > 0) cursor.setDate(cursor.getDate() + 1);
      } else {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    periodEnd.setTime(cursor.getTime());
    periodEnd.setHours(23, 59, 59, 999);

    // Check for existing active billing
    const existingActive = await this.billingRepo.findActiveByContractId(contractId);
    let previousBillingId: string | null = null;
    let mergedAmount = amount;
    let mergedDaysCount = days;
    let mergedPeriodStart = periodStart;

    if (existingActive) {
      // Cancel the existing active billing
      await this.billingRepo.update(existingActive.id, {
        status: BillingStatus.CANCELLED,
      });

      // Merge: combine old billing amount/days with new
      mergedAmount = existingActive.amount + amount;
      mergedDaysCount = existingActive.daysCount + days;
      mergedPeriodStart = new Date(existingActive.periodStart);
      previousBillingId = existingActive.id;
    }

    const billing: Billing = {
      id: uuidv4(),
      billingNumber: this.generateBillingNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: mergedAmount,
      dailyRate: contract.dailyRate,
      daysCount: mergedDaysCount,
      status: BillingStatus.ACTIVE,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      periodStart: mergedPeriodStart,
      periodEnd,
      expiredAt: null,
      paidAt: null,
      invoiceId: null,
      previousBillingId,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.billingRepo.create(billing);

    // Audit log
    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.CREATE,
      module: 'billing',
      entityId: created.id,
      description: `Manual billing created: ${days} days, Rp ${amount.toLocaleString('id-ID')}${existingActive ? ` (merged with ${existingActive.billingNumber})` : ''}`,
      metadata: {
        billingNumber: created.billingNumber,
        days,
        amount: mergedAmount,
        contractId,
        previousBillingId,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return created;
  }

  /**
   * Cancel a billing.
   * - If billing has previousBillingId: reactivate the previous billing
   * - Otherwise: just cancel the billing
   */
  async cancelBilling(billingId: string, adminId: string): Promise<Billing> {
    const billing = await this.billingRepo.findById(billingId);
    if (!billing) throw new Error('Billing not found');
    if (billing.status !== BillingStatus.ACTIVE) throw new Error('Only ACTIVE billings can be cancelled');

    // Cancel current billing
    const cancelled = await this.billingRepo.update(billingId, {
      status: BillingStatus.CANCELLED,
    });

    // If merged billing, reactivate the previous one
    if (billing.previousBillingId) {
      const previous = await this.billingRepo.findById(billing.previousBillingId);
      if (previous) {
        await this.billingRepo.update(previous.id, {
          status: BillingStatus.ACTIVE,
        });
      }
    }

    // Audit log
    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'billing',
      entityId: billingId,
      description: `Billing ${billing.billingNumber} cancelled${billing.previousBillingId ? ' (reverted to previous billing)' : ''}`,
      metadata: {
        billingNumber: billing.billingNumber,
        previousBillingId: billing.previousBillingId,
        contractId: billing.contractId,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return cancelled!;
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
      // Prepaid: if we've reached or passed the usage day (periodStart), payment is overdue
      const periodStart = new Date(billing.periodStart);
      periodStart.setHours(0, 0, 0, 0);

      if (now >= periodStart) {
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
    return `PMT-${y}${m}${d}-${seq}`;
  }
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
