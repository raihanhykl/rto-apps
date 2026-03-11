import {
  IInvoiceRepository,
  IContractRepository,
  IAuditLogRepository,
  PaginationParams,
  PaginatedResult,
} from '../../domain/interfaces';
import { Invoice, Contract, PaymentDay } from '../../domain/entities';
import {
  ContractStatus,
  PaymentStatus,
  InvoiceType,
  AuditAction,
  HolidayScheme,
  PaymentDayStatus,
  DEFAULT_PENALTY_GRACE_DAYS,
  DEFAULT_LATE_FEE_PER_DAY,
} from '../../domain/enums';
import { IPaymentDayRepository } from '../../domain/interfaces';
import { getWibToday, getWibDateParts, toDateKey, getWibParts } from '../../domain/utils/dateUtils';
import { computeLateFee } from '../../domain/utils/lateFeeCalculator';
import { SettingService } from './SettingService';
import { SavingService } from './SavingService';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  status: 'paid' | 'pending' | 'overdue' | 'holiday' | 'not_issued' | 'voided';
  amount?: number;
}

export class PaymentService {
  private static paymentCounter = 0;
  private static countersInitialized = false;
  private savingService?: SavingService;

  constructor(
    private invoiceRepo: IInvoiceRepository,
    private contractRepo: IContractRepository,
    private paymentDayRepo: IPaymentDayRepository,
    private auditRepo: IAuditLogRepository,
    private settingService?: SettingService,
  ) {}

  setSavingService(savingService: SavingService): void {
    this.savingService = savingService;
  }

  private async getSetting(key: string, fallback: number): Promise<number> {
    if (!this.settingService) return fallback;
    return this.settingService.getNumberSetting(key, fallback);
  }

  /**
   * Hitung total late fee berdasarkan umur setiap hari yang belum dibayar.
   * Delegasi ke pure function computeLateFee() di domain layer.
   */
  async calculateLateFee(unpaidDays: PaymentDay[], today: Date): Promise<number> {
    const penaltyGraceDays = await this.getSetting('penalty_grace_days', DEFAULT_PENALTY_GRACE_DAYS);
    const feePerDay = await this.getSetting('late_fee_per_day', DEFAULT_LATE_FEE_PER_DAY);
    return computeLateFee(unpaidDays, today, penaltyGraceDays, feePerDay);
  }

  private async initCounters(): Promise<void> {
    if (!PaymentService.countersInitialized) {
      const maxInvoice = await this.invoiceRepo.findMaxInvoiceSequence();
      PaymentService.paymentCounter = maxInvoice;
      PaymentService.countersInitialized = true;
    }
  }

  // ============ PMT Number Generation ============

  async generatePaymentNumber(): Promise<string> {
    await this.initCounters();
    PaymentService.paymentCounter++;
    const { year, month, day } = getWibDateParts();
    const y = year.toString().slice(-2);
    const m = month.toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    const seq = PaymentService.paymentCounter.toString().padStart(4, '0');
    return `PMT-${y}${m}${d}-${seq}`;
  }

  // ============ Libur Bayar Logic ============

  isLiburBayar(contract: Contract, date: Date): boolean {
    const wib = getWibParts(date);
    if (contract.holidayScheme === HolidayScheme.OLD_CONTRACT) {
      return wib.dayOfWeek === 0; // Semua Minggu = libur
    } else {
      return wib.day > 28; // Tanggal 29-31 = libur
    }
  }

  // ============ PaymentDay Management ============

  /**
   * Generate PaymentDay records dari startDate sejumlah daysAhead calendar days ke depan.
   * Idempotent — skip tanggal yang sudah ada record-nya.
   * Holiday dates langsung set status=HOLIDAY, amount=0.
   * Working dates set status=UNPAID, amount=dailyRate.
   */
  async generatePaymentDaysForPeriod(
    contract: Contract,
    startDate: Date,
    daysAhead: number
  ): Promise<void> {
    const records: PaymentDay[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    for (let i = 0; i < daysAhead; i++) {
      const dateKey = new Date(current);
      dateKey.setHours(0, 0, 0, 0);

      const existing = await this.paymentDayRepo.findByContractAndDate(contract.id, dateKey);
      if (!existing) {
        const isHoliday = this.isLiburBayar(contract, dateKey);
        records.push({
          id: uuidv4(),
          contractId: contract.id,
          date: new Date(dateKey),
          status: isHoliday ? PaymentDayStatus.HOLIDAY : PaymentDayStatus.UNPAID,
          paymentId: null,
          dailyRate: contract.dailyRate,
          amount: isHoliday ? 0 : contract.dailyRate,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      current.setDate(current.getDate() + 1);
    }

    if (records.length > 0) {
      await this.paymentDayRepo.createMany(records);
    }
  }

  /**
   * Untuk setiap kontrak ACTIVE/OVERDUE, pastikan PaymentDay records
   * tersedia sampai 30 hari ke depan dari hari ini.
   */
  async extendPaymentDayRecords(): Promise<void> {
    const today = getWibToday();
    const contracts = [
      ...(await this.contractRepo.findByStatus(ContractStatus.ACTIVE)),
      ...(await this.contractRepo.findByStatus(ContractStatus.OVERDUE)),
    ];

    for (const contract of contracts) {
      if (!contract.billingStartDate) continue;
      await this.generatePaymentDaysForPeriod(contract, today, 30);
    }
  }

  /**
   * Recalculate contract summary fields (totalDaysPaid, workingDaysPaid,
   * holidayDaysPaid, ownershipProgress, endDate) dari PaymentDay records.
   *
   * Menggunakan "contiguous walk" dari billingStartDate:
   * - Hitung PAID dan HOLIDAY yang berturut-turut (tanpa gap UNPAID/PENDING/VOIDED)
   * - Trailing contiguous holidays setelah PAID terakhir dihitung
   * - endDate = tanggal terakhir dalam streak contiguous
   *
   * Juga melakukan bidirectional status transition:
   * - OVERDUE → ACTIVE jika endDate + grace >= today
   * - ACTIVE → OVERDUE jika endDate + grace < today
   */
  private async syncContractFromPaymentDays(contractId: string): Promise<void> {
    const contract = await this.contractRepo.findById(contractId);
    if (!contract) return;

    // Fetch ALL PaymentDay records sorted by date ASC
    const allDays = await this.paymentDayRepo.findByContractId(contractId);

    // Contiguous walk: hitung PAID + HOLIDAY berturut-turut dari awal
    let paidCount = 0;
    let holidayCount = 0;
    let totalAmount = 0;
    let lastContiguousDate: Date | null = null;

    for (const pd of allDays) {
      if (pd.status === PaymentDayStatus.PAID) {
        paidCount++;
        totalAmount += pd.amount;
        lastContiguousDate = pd.date;
      } else if (pd.status === PaymentDayStatus.HOLIDAY) {
        holidayCount++;
        lastContiguousDate = pd.date;
      } else {
        break; // Gap ditemukan — stop counting
      }
    }

    const totalPaid = paidCount + holidayCount;
    const progress = contract.ownershipTargetDays > 0
      ? parseFloat(((totalPaid / contract.ownershipTargetDays) * 100).toFixed(2))
      : 0;

    const updates: Partial<Contract> = {
      totalDaysPaid: totalPaid,
      workingDaysPaid: paidCount,
      holidayDaysPaid: holidayCount,
      ownershipProgress: Math.min(progress, 100),
      durationDays: totalPaid,
      totalAmount,
    };

    if (lastContiguousDate) {
      updates.endDate = lastContiguousDate;
    }

    // Bidirectional status transition
    const today = getWibToday();
    const effectiveEndDate = lastContiguousDate || contract.endDate;
    const graceEnd = new Date(effectiveEndDate);
    graceEnd.setDate(graceEnd.getDate() + contract.gracePeriodDays);

    if (totalPaid >= contract.ownershipTargetDays && contract.status !== ContractStatus.COMPLETED) {
      updates.status = ContractStatus.COMPLETED;
      updates.completedAt = new Date();
    } else if (contract.status === ContractStatus.OVERDUE && graceEnd >= today) {
      updates.status = ContractStatus.ACTIVE;
    } else if (contract.status === ContractStatus.ACTIVE && graceEnd < today) {
      updates.status = ContractStatus.OVERDUE;
    }

    await this.contractRepo.update(contractId, updates);
  }

  // ============ Daily Payment Generation (Scheduler) ============

  async generateDailyPayments(today?: Date): Promise<number> {
    const now = today || getWibToday();
    now.setHours(0, 0, 0, 0);

    const activeContracts = await this.contractRepo.findByStatus(ContractStatus.ACTIVE);
    const overdueContracts = await this.contractRepo.findByStatus(ContractStatus.OVERDUE);
    const contracts = [...activeContracts, ...overdueContracts];
    let generated = 0;

    for (const contract of contracts) {
      if (!contract.billingStartDate) continue;

      const billingStart = new Date(contract.billingStartDate);
      billingStart.setHours(0, 0, 0, 0);

      if (now < billingStart) continue;

      // Ensure PaymentDay records exist from billingStartDate to today (for gap billing)
      const daysFromStart = Math.floor((now.getTime() - billingStart.getTime()) / 86400000) + 1;
      await this.generatePaymentDaysForPeriod(contract, billingStart, daysFromStart);

      // Check if today is a Libur Bayar
      if (this.isLiburBayar(contract, now)) {
        // Check if holiday payment already exists for today
        const todayPd = await this.paymentDayRepo.findByContractAndDate(contract.id, now);
        if (todayPd && todayPd.status === PaymentDayStatus.HOLIDAY) {
          // Check if holiday invoice already created for today
          const existingPayments = await this.invoiceRepo.findByContractId(contract.id);
          const alreadyHasHoliday = existingPayments.some(p =>
            p.isHoliday && p.status === PaymentStatus.PAID && p.periodStart &&
            toDateKey(new Date(p.periodStart)) === toDateKey(now)
          );
          if (!alreadyHasHoliday) {
            const holidayPayment = await this.createHolidayPayment(contract, now);
            // Link holiday PaymentDay to payment
            await this.paymentDayRepo.updateByContractAndDate(contract.id, now, {
              paymentId: holidayPayment.id,
            });
            generated++;
          }
        }
        continue;
      }

      // Check if there's already an active (PENDING) payment for this contract
      const activePayment = await this.invoiceRepo.findActiveByContractId(contract.id);
      if (activePayment) continue;

      // Opsi B: Query ALL UNPAID PaymentDays where date <= today
      const allUnpaid = await this.paymentDayRepo.findByContractAndStatus(contract.id, PaymentDayStatus.UNPAID);
      const unpaidDays = allUnpaid.filter(pd => {
        const pdDate = new Date(pd.date);
        pdDate.setHours(0, 0, 0, 0);
        return pdDate <= now;
      });

      if (unpaidDays.length === 0) continue;

      const totalAmount = unpaidDays.reduce((sum, pd) => sum + pd.amount, 0);
      const lateFee = await this.calculateLateFee(unpaidDays, now);
      const periodStart = new Date(unpaidDays[0].date);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(unpaidDays[unpaidDays.length - 1].date);
      periodEnd.setHours(23, 59, 59, 999);

      const payment: Invoice = {
        id: uuidv4(),
        invoiceNumber: await this.generatePaymentNumber(),
        contractId: contract.id,
        customerId: contract.customerId,
        amount: totalAmount,
        lateFee,
        type: InvoiceType.DAILY_BILLING,
        status: PaymentStatus.PENDING,
        qrCodeData: '',
        dueDate: periodEnd,
        paidAt: null,
        extensionDays: unpaidDays.length,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        dailyRate: contract.dailyRate,
        daysCount: unpaidDays.length,
        periodStart,
        periodEnd,
        expiredAt: null,
        previousPaymentId: null,
        isHoliday: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newPayment = await this.invoiceRepo.create(payment);

      // Link all UNPAID days to new payment → PENDING
      for (const pd of unpaidDays) {
        await this.paymentDayRepo.update(pd.id, {
          status: PaymentDayStatus.PENDING,
          paymentId: newPayment.id,
        });
      }

      generated++;
    }

    return generated;
  }

  private async createHolidayPayment(contract: Contract, targetDate: Date): Promise<Invoice> {
    const periodStart = new Date(targetDate);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(targetDate);
    periodEnd.setHours(23, 59, 59, 999);

    const payment: Invoice = {
      id: uuidv4(),
      invoiceNumber: await this.generatePaymentNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: 0,
      lateFee: 0,
      type: InvoiceType.DAILY_BILLING,
      status: PaymentStatus.PAID, // auto-paid, no payment needed
      qrCodeData: '',
      dueDate: periodEnd,
      paidAt: new Date(),
      extensionDays: 0,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: contract.dailyRate,
      daysCount: 0,
      periodStart,
      periodEnd,
      expiredAt: null,
      previousPaymentId: null,
      isHoliday: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.invoiceRepo.create(payment);

    // Recalculate contract from PaymentDay data (contiguous walk)
    await this.syncContractFromPaymentDays(contract.id);

    return created;
  }

  // ============ Rollover ============

  async rolloverExpiredPayments(today?: Date): Promise<number> {
    const now = today || getWibToday();
    now.setHours(0, 0, 0, 0);

    // Find all PENDING daily/manual payments
    const pendingPayments = await this.invoiceRepo.findByStatus(PaymentStatus.PENDING);
    let rolledOver = 0;

    for (const payment of pendingPayments) {
      if (payment.type !== InvoiceType.DAILY_BILLING && payment.type !== InvoiceType.MANUAL_PAYMENT) continue;
      if (!payment.periodEnd) continue;

      const periodEnd = new Date(payment.periodEnd);
      periodEnd.setHours(0, 0, 0, 0);

      if (now > periodEnd) {
        const contract = await this.contractRepo.findById(payment.contractId);
        if (!contract) continue;
        if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.OVERDUE) continue;

        await this.rolloverPayment(payment, contract, now);
        rolledOver++;
      }
    }

    return rolledOver;
  }

  private async rolloverPayment(expiredPayment: Invoice, contract: Contract, today: Date): Promise<Invoice> {
    // Mark old payment as EXPIRED
    await this.invoiceRepo.update(expiredPayment.id, {
      status: PaymentStatus.EXPIRED,
      expiredAt: new Date(),
    });

    // Unlink all PaymentDay from expired payment → back to UNPAID
    await this.paymentDayRepo.updateManyByPaymentId(expiredPayment.id, {
      status: PaymentDayStatus.UNPAID,
      paymentId: null,
    });

    // Ensure PaymentDay records exist from billingStartDate to today (for gap billing)
    if (contract.billingStartDate) {
      const billingStart = new Date(contract.billingStartDate);
      billingStart.setHours(0, 0, 0, 0);
      const daysFromStart = Math.floor((today.getTime() - billingStart.getTime()) / 86400000) + 1;
      await this.generatePaymentDaysForPeriod(contract, billingStart, daysFromStart);
    } else {
      await this.generatePaymentDaysForPeriod(contract, today, 1);
    }

    // Check if today is a Libur Bayar — holiday already handled by generateDailyPayments
    // so just create the rollover invoice with accumulated UNPAID days

    // Opsi B: Link ALL UNPAID days (including gap) to new payment
    const allUnpaid = await this.paymentDayRepo.findByContractAndStatus(contract.id, PaymentDayStatus.UNPAID);
    const unpaidDays = allUnpaid.filter(pd => {
      const pdDate = new Date(pd.date);
      pdDate.setHours(0, 0, 0, 0);
      return pdDate <= today;
    });

    if (unpaidDays.length === 0) {
      // Edge case: no unpaid days (all holidays?), create minimal rollover
      const periodEnd = new Date(today);
      periodEnd.setHours(23, 59, 59, 999);
      const newPayment: Invoice = {
        id: uuidv4(),
        invoiceNumber: await this.generatePaymentNumber(),
        contractId: contract.id,
        customerId: contract.customerId,
        amount: 0,
        lateFee: 0,
        type: InvoiceType.DAILY_BILLING,
        status: PaymentStatus.PENDING,
        qrCodeData: '',
        dueDate: periodEnd,
        paidAt: null,
        extensionDays: 0,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        dailyRate: contract.dailyRate,
        daysCount: 0,
        periodStart: expiredPayment.periodStart!,
        periodEnd,
        expiredAt: null,
        previousPaymentId: null,
        isHoliday: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return this.invoiceRepo.create(newPayment);
    }

    const totalAmount = unpaidDays.reduce((sum, pd) => sum + pd.amount, 0);
    const lateFee = await this.calculateLateFee(unpaidDays, today);
    const periodStart = new Date(unpaidDays[0].date);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(unpaidDays[unpaidDays.length - 1].date);
    periodEnd.setHours(23, 59, 59, 999);

    const newPayment: Invoice = {
      id: uuidv4(),
      invoiceNumber: await this.generatePaymentNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: totalAmount,
      lateFee,
      type: InvoiceType.DAILY_BILLING,
      status: PaymentStatus.PENDING,
      qrCodeData: '',
      dueDate: periodEnd,
      paidAt: null,
      extensionDays: unpaidDays.length,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: contract.dailyRate,
      daysCount: unpaidDays.length,
      periodStart,
      periodEnd,
      expiredAt: null,
      previousPaymentId: null,
      isHoliday: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.invoiceRepo.create(newPayment);

    // Link all UNPAID days to new payment
    for (const pd of unpaidDays) {
      await this.paymentDayRepo.update(pd.id, {
        status: PaymentDayStatus.PENDING,
        paymentId: created.id,
      });
    }

    return created;
  }

  // ============ Pay / Mark Paid ============

  async payPayment(paymentId: string, adminId: string): Promise<Invoice> {
    const payment = await this.invoiceRepo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');

    if (payment.status === PaymentStatus.PAID) {
      throw new Error('Payment already paid');
    }
    if (payment.status === PaymentStatus.EXPIRED) {
      throw new Error('Payment has expired. A new payment should be active.');
    }
    if (payment.status === PaymentStatus.VOID) {
      throw new Error('Payment has been cancelled');
    }

    const contract = await this.contractRepo.findById(payment.contractId);
    if (!contract) throw new Error('Contract not found');

    // Mark as PAID
    const updated = await this.invoiceRepo.update(paymentId, {
      status: PaymentStatus.PAID,
      paidAt: new Date(),
    });
    if (!updated) throw new Error('Failed to update payment');

    // Update PaymentDay records → PAID
    if (payment.type === InvoiceType.DAILY_BILLING || payment.type === InvoiceType.MANUAL_PAYMENT) {
      await this.paymentDayRepo.updateManyByPaymentId(payment.id, {
        status: PaymentDayStatus.PAID,
      });
    }

    // Credit days to contract
    if (payment.type === InvoiceType.DAILY_BILLING || payment.type === InvoiceType.MANUAL_PAYMENT) {
      // Recalculate contract from PaymentDay data (replaces manual creditDayToContract)
      await this.syncContractFromPaymentDays(payment.contractId);
    } else {
      // DP / DP_INSTALLMENT
      await this.applyDPPayment(payment, contract);
    }

    // Auto-credit saving
    if (this.savingService && !payment.isHoliday && payment.daysCount && payment.daysCount > 0) {
      try {
        await this.savingService.creditFromPayment(payment.id, adminId);
      } catch (error) {
        console.error('Failed to credit saving:', error);
        // Tidak throw — saving credit failure TIDAK boleh menggagalkan pembayaran
      }
    }

    // Audit log
    const totalPayable = payment.amount + (payment.lateFee || 0);
    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.PAYMENT,
      module: 'payment',
      entityId: paymentId,
      description: `Payment ${payment.invoiceNumber} paid - ${payment.daysCount || 0} days, Rp ${totalPayable.toLocaleString('id-ID')}`,
      metadata: {
        paymentNumber: payment.invoiceNumber,
        amount: payment.amount,
        daysCount: payment.daysCount,
        contractId: payment.contractId,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  private async applyDPPayment(invoice: Invoice, contract: Contract): Promise<void> {
    const newDpPaid = contract.dpPaidAmount + invoice.amount;
    const dpFullyPaid = newDpPaid >= contract.dpAmount;
    await this.contractRepo.update(invoice.contractId, {
      dpPaidAmount: newDpPaid,
      dpFullyPaid,
    });
  }

  // ============ Manual Payment ============

  async previewManualPayment(contractId: string, days: number): Promise<{
    amount: number;
    lateFee: number;
    total: number;
    daysCount: number;
    dailyRate: number;
  }> {
    if (days < 1 || days > 7) throw new Error('Manual payment must be 1-7 days');

    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');
    if (!contract.billingStartDate) throw new Error('Billing has not started yet');

    const today = getWibToday();

    // Ensure PaymentDay records exist
    const billingStart = new Date(contract.billingStartDate);
    billingStart.setHours(0, 0, 0, 0);
    const futureEnd = new Date(today);
    futureEnd.setDate(futureEnd.getDate() + 7);
    const totalDaysToGenerate = Math.floor((futureEnd.getTime() - billingStart.getTime()) / 86400000) + 1;
    await this.generatePaymentDaysForPeriod(contract, billingStart, totalDaysToGenerate);

    // Check existing active payment (same logic as createManualPayment)
    const existingActive = await this.invoiceRepo.findActiveByContractId(contractId);
    const existingDaysCount = existingActive ? (existingActive.daysCount || 0) : 0;

    // FIFO: query ALL UNPAID + PENDING working days
    const allUnpaid = await this.paymentDayRepo.findByContractAndStatus(contract.id, PaymentDayStatus.UNPAID);
    const pendingDays = existingActive
      ? await this.paymentDayRepo.findByContractAndStatus(contract.id, PaymentDayStatus.PENDING)
      : [];
    const combinedDays = [...allUnpaid, ...pendingDays]
      .filter(pd => pd.amount > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalDaysNeeded = existingDaysCount + days;
    const selectedDays = combinedDays.slice(0, totalDaysNeeded);

    if (selectedDays.length === 0) throw new Error('No unpaid days available');

    const amount = selectedDays.reduce((sum, pd) => sum + pd.amount, 0);
    const lateFee = await this.calculateLateFee(selectedDays, today);

    return {
      amount,
      lateFee,
      total: amount + lateFee,
      daysCount: selectedDays.length,
      dailyRate: contract.dailyRate,
    };
  }

  async createManualPayment(contractId: string, days: number, adminId: string): Promise<Invoice> {
    if (days < 1 || days > 7) throw new Error('Manual payment must be 1-7 days');

    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');
    if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.OVERDUE) {
      throw new Error('Contract must be ACTIVE or OVERDUE');
    }
    if (!contract.billingStartDate) throw new Error('Billing has not started yet');

    const today = getWibToday();

    // Ensure PaymentDay records exist from billingStartDate to today + 7 days
    const billingStart = new Date(contract.billingStartDate);
    billingStart.setHours(0, 0, 0, 0);
    const futureEnd = new Date(today);
    futureEnd.setDate(futureEnd.getDate() + 7);
    const totalDaysToGenerate = Math.floor((futureEnd.getTime() - billingStart.getTime()) / 86400000) + 1;
    await this.generatePaymentDaysForPeriod(contract, billingStart, totalDaysToGenerate);

    // Check for existing active payment
    const existingActive = await this.invoiceRepo.findActiveByContractId(contractId);
    let previousPaymentId: string | null = null;
    let existingDaysCount = 0;

    if (existingActive) {
      existingDaysCount = existingActive.daysCount || 0;

      // Void existing active payment and unlink its PaymentDays → UNPAID
      await this.invoiceRepo.update(existingActive.id, {
        status: PaymentStatus.VOID,
      });
      await this.paymentDayRepo.updateManyByPaymentId(existingActive.id, {
        status: PaymentDayStatus.UNPAID,
        paymentId: null,
      });

      previousPaymentId = existingActive.id;
    }

    // FIFO: query ALL UNPAID working days, sorted by date ASC (oldest first)
    const allUnpaid = await this.paymentDayRepo.findByContractAndStatus(contract.id, PaymentDayStatus.UNPAID);
    const unpaidWorkingDays = allUnpaid.filter(pd => pd.amount > 0); // exclude holidays (amount=0)

    const totalDaysNeeded = existingDaysCount + days;
    const selectedDays = unpaidWorkingDays.slice(0, totalDaysNeeded);

    if (selectedDays.length === 0) throw new Error('No unpaid days available');

    const totalAmount = selectedDays.reduce((sum, pd) => sum + pd.amount, 0);
    const lateFee = await this.calculateLateFee(selectedDays, today);
    const periodStart = new Date(selectedDays[0].date);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(selectedDays[selectedDays.length - 1].date);
    periodEnd.setHours(23, 59, 59, 999);

    const payment: Invoice = {
      id: uuidv4(),
      invoiceNumber: await this.generatePaymentNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: totalAmount,
      lateFee,
      type: InvoiceType.MANUAL_PAYMENT,
      status: PaymentStatus.PENDING,
      qrCodeData: '',
      dueDate: periodEnd,
      paidAt: null,
      extensionDays: selectedDays.length,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: contract.dailyRate,
      daysCount: selectedDays.length,
      periodStart,
      periodEnd,
      expiredAt: null,
      previousPaymentId,
      isHoliday: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.invoiceRepo.create(payment);

    // Link selected UNPAID days to new payment → PENDING
    for (const pd of selectedDays) {
      await this.paymentDayRepo.update(pd.id, {
        status: PaymentDayStatus.PENDING,
        paymentId: created.id,
      });
    }

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.CREATE,
      module: 'payment',
      entityId: created.id,
      description: `Manual payment created: ${days} days, Rp ${(days * contract.dailyRate).toLocaleString('id-ID')}${existingActive ? ` (merged with ${existingActive.invoiceNumber}, total ${selectedDays.length} days)` : ''}`,
      metadata: {
        paymentNumber: created.invoiceNumber,
        days,
        amount: totalAmount,
        contractId,
        previousPaymentId,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return created;
  }

  // ============ Cancel Payment ============

  async cancelPayment(paymentId: string, adminId: string): Promise<Invoice> {
    const payment = await this.invoiceRepo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== PaymentStatus.PENDING) throw new Error('Only PENDING payments can be cancelled');

    const cancelled = await this.invoiceRepo.update(paymentId, {
      status: PaymentStatus.VOID,
    });

    // Kembalikan PaymentDay ke UNPAID
    await this.paymentDayRepo.updateManyByPaymentId(paymentId, {
      status: PaymentDayStatus.UNPAID,
      paymentId: null,
    });

    // If merged payment, reactivate the previous one
    if (payment.previousPaymentId) {
      const previous = await this.invoiceRepo.findById(payment.previousPaymentId);
      if (previous) {
        await this.invoiceRepo.update(previous.id, {
          status: PaymentStatus.PENDING,
        });

        // Re-link PaymentDay to reactivated previous payment
        if (previous.periodStart && previous.periodEnd) {
          const prevContract = await this.contractRepo.findById(payment.contractId);
          if (prevContract) {
            const d = new Date(previous.periodStart);
            d.setHours(0, 0, 0, 0);
            const end = new Date(previous.periodEnd);
            end.setHours(0, 0, 0, 0);
            while (d <= end) {
              if (!this.isLiburBayar(prevContract, d)) {
                await this.paymentDayRepo.updateByContractAndDate(payment.contractId, new Date(d), {
                  status: PaymentDayStatus.PENDING,
                  paymentId: previous.id,
                });
              }
              d.setDate(d.getDate() + 1);
            }
          }
        }
      }
    }

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'payment',
      entityId: paymentId,
      description: `Payment ${payment.invoiceNumber} cancelled${payment.previousPaymentId ? ' (reverted to previous payment)' : ''}`,
      metadata: {
        paymentNumber: payment.invoiceNumber,
        previousPaymentId: payment.previousPaymentId,
        contractId: payment.contractId,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return cancelled!;
  }

  // ============ Calendar ============

  async getCalendarData(contractId: string, year: number, month: number): Promise<CalendarDay[]> {
    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');

    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, month, 0);
    endDate.setHours(0, 0, 0, 0);
    const daysInMonth = endDate.getDate();

    const today = getWibToday();

    const paymentDays = await this.paymentDayRepo.findByContractAndDateRange(contractId, startDate, endDate);

    const dayMap = new Map<string, PaymentDay>();
    paymentDays.forEach(pd => {
      dayMap.set(toDateKey(pd.date), pd);
    });

    const result: CalendarDay[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      date.setHours(0, 0, 0, 0);
      const dateKeyStr = toDateKey(date);

      const pd = dayMap.get(dateKeyStr);

      if (!pd) {
        result.push({ date: dateKeyStr, status: 'not_issued' });
        continue;
      }

      switch (pd.status) {
        case PaymentDayStatus.PAID:
          result.push({ date: dateKeyStr, status: 'paid', amount: pd.amount });
          break;
        case PaymentDayStatus.PENDING:
          result.push({ date: dateKeyStr, status: 'pending', amount: pd.amount });
          break;
        case PaymentDayStatus.HOLIDAY:
          result.push({ date: dateKeyStr, status: 'holiday' });
          break;
        case PaymentDayStatus.VOIDED:
          result.push({ date: dateKeyStr, status: 'voided' });
          break;
        case PaymentDayStatus.UNPAID:
          result.push({
            date: dateKeyStr,
            status: date <= today ? 'overdue' : 'not_issued',
            amount: pd.amount,
          });
          break;
      }
    }

    return result;
  }

  // ============ Active Payment ============

  async getActivePaymentByContractId(contractId: string): Promise<Invoice | null> {
    return this.invoiceRepo.findActiveByContractId(contractId);
  }

  // ============ CRUD / Query (from InvoiceService) ============

  async getAll(): Promise<Invoice[]> {
    return this.invoiceRepo.findAll();
  }

  async getAllPaginated(params: PaginationParams): Promise<PaginatedResult<Invoice>> {
    return this.invoiceRepo.findAllPaginated(params);
  }

  async getById(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findById(id);
    if (!invoice) throw new Error('Payment not found');
    return invoice;
  }

  async getByContractId(contractId: string): Promise<Invoice[]> {
    return this.invoiceRepo.findByContractId(contractId);
  }

  async getByCustomerId(customerId: string): Promise<Invoice[]> {
    return this.invoiceRepo.findByCustomerId(customerId);
  }

  async search(query: string): Promise<Invoice[]> {
    return this.invoiceRepo.search(query);
  }

  // ============ QR Code ============

  async generateQRCode(paymentId: string): Promise<string> {
    const payment = await this.invoiceRepo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');

    const totalPayable = payment.amount + (payment.lateFee || 0);
    const qrData = JSON.stringify({
      invoiceNumber: payment.invoiceNumber,
      amount: totalPayable,
      payTo: 'WEDISON Motor Listrik',
      reference: payment.qrCodeData,
    });

    return QRCode.toDataURL(qrData);
  }

  // ============ Simulate Payment (Dev) ============

  async simulatePayment(
    paymentId: string,
    status: PaymentStatus.PAID | PaymentStatus.FAILED,
    adminId: string
  ): Promise<Invoice> {
    const payment = await this.invoiceRepo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');

    if (payment.status === PaymentStatus.PAID) {
      throw new Error('Payment already paid');
    }

    const updateData: Partial<Invoice> = {
      status,
      paidAt: status === PaymentStatus.PAID ? new Date() : null,
    };

    const updated = await this.invoiceRepo.update(paymentId, updateData);
    if (!updated) throw new Error('Failed to update payment');

    if (status === PaymentStatus.PAID) {
      // Update PaymentDay records → PAID
      if (payment.type === InvoiceType.DAILY_BILLING || payment.type === InvoiceType.MANUAL_PAYMENT) {
        await this.paymentDayRepo.updateManyByPaymentId(payment.id, {
          status: PaymentDayStatus.PAID,
        });
      }

      const contract = await this.contractRepo.findById(payment.contractId);
      if (contract) {
        if (payment.type === InvoiceType.DP || payment.type === InvoiceType.DP_INSTALLMENT) {
          await this.applyDPPayment(payment, contract);
        } else {
          await this.syncContractFromPaymentDays(payment.contractId);
        }
      }
    }

    const totalPayable = payment.amount + (payment.lateFee || 0);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.PAYMENT,
      module: 'payment',
      entityId: paymentId,
      description: `Payment ${status.toLowerCase()} for ${payment.invoiceNumber} - Rp ${totalPayable.toLocaleString('id-ID')}`,
      metadata: {
        paymentNumber: payment.invoiceNumber,
        amount: payment.amount,
        lateFee: payment.lateFee,
        paymentStatus: status,
        extensionDays: payment.extensionDays,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  // ============ Void ============

  async voidPayment(paymentId: string, adminId: string): Promise<Invoice> {
    const payment = await this.invoiceRepo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');

    if (payment.status === PaymentStatus.PAID) {
      throw new Error('Cannot void a paid payment');
    }
    if (payment.status === PaymentStatus.VOID) {
      throw new Error('Payment already voided');
    }

    const updated = await this.invoiceRepo.update(paymentId, { status: PaymentStatus.VOID });
    if (!updated) throw new Error('Failed to update payment');

    // Kembalikan PaymentDay ke UNPAID
    await this.paymentDayRepo.updateManyByPaymentId(paymentId, {
      status: PaymentDayStatus.UNPAID,
      paymentId: null,
    });

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'payment',
      entityId: paymentId,
      description: `Voided payment ${payment.invoiceNumber} - Rp ${payment.amount.toLocaleString('id-ID')}`,
      metadata: { paymentNumber: payment.invoiceNumber, amount: payment.amount, previousStatus: payment.status },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  // ============ Revert ============

  private async revertPaymentFromContract(invoice: Invoice): Promise<void> {
    const contract = await this.contractRepo.findById(invoice.contractId);
    if (!contract) return;

    if (invoice.type === InvoiceType.DP || invoice.type === InvoiceType.DP_INSTALLMENT) {
      const newDpPaid = Math.max(0, contract.dpPaidAmount - invoice.amount);
      await this.contractRepo.update(invoice.contractId, {
        dpPaidAmount: newDpPaid,
        dpFullyPaid: newDpPaid >= contract.dpAmount,
      });
      return;
    }

    if (!invoice.extensionDays || invoice.extensionDays <= 0) return;

    const newTotalDaysPaid = Math.max(0, contract.totalDaysPaid - invoice.extensionDays);
    const newProgress = contract.ownershipTargetDays > 0
      ? parseFloat(((newTotalDaysPaid / contract.ownershipTargetDays) * 100).toFixed(2))
      : 0;

    const updateData: Partial<Contract> = {
      totalDaysPaid: newTotalDaysPaid,
      workingDaysPaid: Math.max(0, contract.workingDaysPaid - invoice.extensionDays),
      ownershipProgress: Math.min(newProgress, 100),
      durationDays: Math.max(0, contract.durationDays - invoice.extensionDays),
      totalAmount: Math.max(0, contract.totalAmount - invoice.amount - (invoice.lateFee || 0)),
    };

    if (contract.status === ContractStatus.COMPLETED && contract.completedAt) {
      updateData.status = ContractStatus.ACTIVE;
      updateData.completedAt = null;
    }

    await this.contractRepo.update(invoice.contractId, updateData);
  }

  async revertPaymentStatus(paymentId: string, adminId: string): Promise<Invoice> {
    const payment = await this.invoiceRepo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');

    if (payment.status === PaymentStatus.PENDING) {
      throw new Error('Payment sudah berstatus PENDING, tidak bisa di-revert');
    }

    const previousStatus = payment.status;

    if (previousStatus === PaymentStatus.PAID) {
      // Revert PAID → PENDING: keep paymentId linked, just change status back to PENDING
      await this.paymentDayRepo.updateManyByPaymentId(payment.id, {
        status: PaymentDayStatus.PENDING,
      });

      // Handle DP revert separately (not tracked via PaymentDay)
      if (payment.type === InvoiceType.DP || payment.type === InvoiceType.DP_INSTALLMENT) {
        await this.revertPaymentFromContract(payment);
      } else {
        // Recalculate contract from PaymentDay data
        await this.syncContractFromPaymentDays(payment.contractId);
      }

      // Auto-reverse saving
      if (this.savingService) {
        try {
          await this.savingService.reverseCreditFromPayment(payment.id, adminId);
        } catch (error) {
          console.error('Failed to reverse saving:', error);
          // Tidak throw — saving reversal failure TIDAK boleh menggagalkan revert
        }
      }
    } else if (previousStatus === PaymentStatus.VOID || previousStatus === PaymentStatus.EXPIRED) {
      // Revert VOID/EXPIRED → PENDING: re-link UNPAID days in the payment's period range
      if (payment.periodStart && payment.periodEnd &&
          (payment.type === InvoiceType.DAILY_BILLING || payment.type === InvoiceType.MANUAL_PAYMENT)) {
        const unpaidDays = await this.paymentDayRepo.findByContractAndDateRange(
          payment.contractId,
          new Date(payment.periodStart),
          new Date(payment.periodEnd),
        );
        const daysToRelink = unpaidDays
          .filter(pd => pd.status === PaymentDayStatus.UNPAID && pd.amount > 0);

        for (const pd of daysToRelink) {
          await this.paymentDayRepo.update(pd.id, {
            status: PaymentDayStatus.PENDING,
            paymentId: payment.id,
          });
        }

        await this.syncContractFromPaymentDays(payment.contractId);
      }
    }

    const updated = await this.invoiceRepo.update(paymentId, {
      status: PaymentStatus.PENDING,
      paidAt: null,
    });
    if (!updated) throw new Error('Failed to update payment');

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'payment',
      entityId: paymentId,
      description: `Reverted payment ${payment.invoiceNumber} from ${previousStatus} to PENDING`,
      metadata: {
        paymentNumber: payment.invoiceNumber,
        previousStatus,
        amount: payment.amount,
        lateFee: payment.lateFee,
        extensionDays: payment.extensionDays,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  // ============ Admin Correction ============

  async updatePaymentDayStatus(
    contractId: string,
    date: Date,
    newStatus: PaymentDayStatus,
    adminId: string,
    notes?: string,
  ): Promise<PaymentDay> {
    date.setHours(0, 0, 0, 0);
    const pd = await this.paymentDayRepo.findByContractAndDate(contractId, date);
    if (!pd) throw new Error('PaymentDay not found for this date');

    if (pd.status === PaymentDayStatus.VOIDED) {
      throw new Error('Cannot modify a voided day');
    }

    const updated = await this.paymentDayRepo.update(pd.id, {
      status: newStatus,
      notes: notes || pd.notes,
      paymentId: newStatus === PaymentDayStatus.UNPAID ? null : pd.paymentId,
      amount: newStatus === PaymentDayStatus.HOLIDAY ? 0 : pd.dailyRate,
    });
    if (!updated) throw new Error('Failed to update PaymentDay');

    await this.syncContractFromPaymentDays(contractId);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'payment_day',
      entityId: pd.id,
      description: `Admin correction: ${pd.status} → ${newStatus} for ${toDateKey(date)}`,
      metadata: { contractId, date: toDateKey(date), oldStatus: pd.status, newStatus, notes },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  // ============ Reduce Payment (Partial Payment) ============

  async reducePayment(
    paymentId: string,
    newDaysCount: number,
    adminId: string,
    notes?: string,
  ): Promise<Invoice> {
    const payment = await this.invoiceRepo.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new Error('Can only reduce PENDING payments');
    }
    if (newDaysCount < 1) throw new Error('newDaysCount must be at least 1');
    if (newDaysCount >= (payment.daysCount || 0)) {
      throw new Error('newDaysCount must be less than current daysCount');
    }

    const contract = await this.contractRepo.findById(payment.contractId);
    if (!contract) throw new Error('Contract not found');

    // Step 1: Void invoice lama
    await this.invoiceRepo.update(payment.id, { status: PaymentStatus.VOID });

    // Unlink semua PaymentDay dari invoice lama → UNPAID
    await this.paymentDayRepo.updateManyByPaymentId(payment.id, {
      status: PaymentDayStatus.UNPAID,
      paymentId: null,
    });

    // Step 2: Ambil PaymentDay UNPAID, sorted by date ascending, pilih newDaysCount hari paling awal
    const allUnpaid = await this.paymentDayRepo.findByContractAndStatus(
      contract.id,
      PaymentDayStatus.UNPAID,
    );
    const eligibleDays = allUnpaid
      .filter(pd => {
        const d = new Date(pd.date);
        d.setHours(0, 0, 0, 0);
        return d <= getWibToday();
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, newDaysCount);

    if (eligibleDays.length === 0) throw new Error('No eligible UNPAID days found');

    const periodStart = new Date(eligibleDays[0].date);
    const periodEnd = new Date(eligibleDays[eligibleDays.length - 1].date);
    const totalAmount = eligibleDays.reduce((sum, pd) => sum + pd.amount, 0);
    const today = getWibToday();
    const lateFee = await this.calculateLateFee(eligibleDays, today);

    // Step 3: Buat invoice baru
    const newPayment: Invoice = {
      id: uuidv4(),
      invoiceNumber: await this.generatePaymentNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: totalAmount,
      lateFee,
      type: InvoiceType.DAILY_BILLING,
      status: PaymentStatus.PENDING,
      qrCodeData: '',
      dueDate: new Date(periodEnd.getTime()),
      paidAt: null,
      extensionDays: eligibleDays.length,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: contract.dailyRate,
      daysCount: eligibleDays.length,
      periodStart,
      periodEnd,
      expiredAt: null,
      previousPaymentId: payment.id,
      isHoliday: false,
      description: `Reduced payment: ${eligibleDays.length} days (from ${payment.daysCount} days)`,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Invoice;
    const created = await this.invoiceRepo.create(newPayment);

    // Step 4: Link PaymentDay yang ter-cover ke invoice baru → PENDING
    for (const pd of eligibleDays) {
      await this.paymentDayRepo.update(pd.id, {
        status: PaymentDayStatus.PENDING,
        paymentId: created.id,
      });
    }

    // Audit log
    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'payment',
      entityId: created.id,
      description: `Reduced payment from ${payment.daysCount} days to ${eligibleDays.length} days. Old: ${payment.invoiceNumber}, New: ${created.invoiceNumber}`,
      metadata: {
        oldPaymentId: payment.id,
        newPaymentId: created.id,
        oldDaysCount: payment.daysCount,
        newDaysCount: eligibleDays.length,
        remainingUnpaidDays: allUnpaid.length - eligibleDays.length,
        notes,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return created;
  }

  // ============ Data Migration ============

  async migrateExistingContracts(): Promise<number> {
    const today = getWibToday();
    const contracts = await this.contractRepo.findAll();
    let migrated = 0;

    for (const contract of contracts) {
      if (!contract.billingStartDate) continue;

      const billingStart = new Date(contract.billingStartDate);
      billingStart.setHours(0, 0, 0, 0);
      const endDate = new Date(contract.endDate);
      endDate.setHours(0, 0, 0, 0);

      const targetEnd = new Date(today);
      targetEnd.setDate(targetEnd.getDate() + 30);

      let current = new Date(billingStart);
      while (current <= targetEnd) {
        const d = new Date(current);
        d.setHours(0, 0, 0, 0);

        const existing = await this.paymentDayRepo.findByContractAndDate(contract.id, d);
        if (!existing) {
          const isHoliday = this.isLiburBayar(contract, d);

          let status: PaymentDayStatus;
          if (isHoliday) {
            status = PaymentDayStatus.HOLIDAY;
          } else if (d <= endDate && contract.totalDaysPaid > 0) {
            status = PaymentDayStatus.PAID;
          } else {
            status = PaymentDayStatus.UNPAID;
          }

          // Check PENDING
          if (status === PaymentDayStatus.UNPAID) {
            const activePayment = await this.invoiceRepo.findActiveByContractId(contract.id);
            if (activePayment && activePayment.periodStart && activePayment.periodEnd) {
              const ps = new Date(activePayment.periodStart);
              ps.setHours(0, 0, 0, 0);
              const pe = new Date(activePayment.periodEnd);
              pe.setHours(0, 0, 0, 0);
              if (d >= ps && d <= pe) {
                status = PaymentDayStatus.PENDING;
              }
            }
          }

          await this.paymentDayRepo.create({
            id: uuidv4(),
            contractId: contract.id,
            date: d,
            status,
            paymentId: null,
            dailyRate: contract.dailyRate,
            amount: isHoliday ? 0 : contract.dailyRate,
            notes: status === PaymentDayStatus.PAID ? 'Migrated from legacy data' : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        current.setDate(current.getDate() + 1);
      }

      // Void future days for cancelled/repossessed contracts
      if (contract.status === ContractStatus.CANCELLED || contract.status === ContractStatus.REPOSSESSED) {
        const unpaidDays = await this.paymentDayRepo.findByContractAndStatus(contract.id, PaymentDayStatus.UNPAID);
        for (const day of unpaidDays) {
          await this.paymentDayRepo.update(day.id, { status: PaymentDayStatus.VOIDED });
        }
      }

      migrated++;
    }

    return migrated;
  }

  // ============ Stats ============

  async count(): Promise<number> {
    return this.invoiceRepo.count();
  }

  async countByStatus(status: PaymentStatus): Promise<number> {
    return this.invoiceRepo.countByStatus(status);
  }

  async totalRevenue(): Promise<number> {
    return this.invoiceRepo.sumByStatus(PaymentStatus.PAID);
  }

  async totalPending(): Promise<number> {
    return this.invoiceRepo.sumByStatus(PaymentStatus.PENDING);
  }

  // ============ Bulk ============

  async bulkMarkPaid(paymentIds: string[], adminId: string): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of paymentIds) {
      try {
        await this.payPayment(id, adminId);
        success.push(id);
      } catch (error: any) {
        failed.push({ id, error: error.message });
      }
    }

    return { success, failed };
  }
}
