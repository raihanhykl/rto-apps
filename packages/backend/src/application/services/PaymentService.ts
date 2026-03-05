import {
  IInvoiceRepository,
  IContractRepository,
  IAuditLogRepository,
  PaginationParams,
  PaginatedResult,
} from '../../domain/interfaces';
import { Invoice, Contract } from '../../domain/entities';
import {
  ContractStatus,
  PaymentStatus,
  InvoiceType,
  AuditAction,
} from '../../domain/enums';
import { getWibToday, getWibDateParts } from '../../domain/utils/dateUtils';
import { SettingService } from './SettingService';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  status: 'paid' | 'pending' | 'overdue' | 'holiday' | 'not_issued';
  amount?: number;
}

export class PaymentService {
  private static paymentCounter = 0;
  private static countersInitialized = false;

  constructor(
    private invoiceRepo: IInvoiceRepository,
    private contractRepo: IContractRepository,
    private auditRepo: IAuditLogRepository,
    private settingService?: SettingService,
  ) {}

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

  isLiburBayar(contract: Contract, date: Date): boolean {
    if (date.getDay() !== 0) return false;
    const holidays = this.getSundayHolidays(
      date.getFullYear(),
      date.getMonth() + 1,
      contract.holidayDaysPerMonth,
    );
    return holidays.has(date.getDate());
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

      // Check if there's already an active (PENDING) payment for this contract
      const activePayment = await this.invoiceRepo.findActiveByContractId(contract.id);
      if (activePayment) continue;

      // Determine first unpaid day
      const endDate = new Date(contract.endDate);
      endDate.setHours(0, 0, 0, 0);

      const firstUnpaidDay = new Date(Math.max(endDate.getTime() + 86400000, billingStart.getTime()));
      firstUnpaidDay.setHours(0, 0, 0, 0);

      if (firstUnpaidDay > now) continue;

      if (firstUnpaidDay < now) {
        // Accumulated unpaid days
        let unpaidWorkingDays = 0;
        const cursor = new Date(firstUnpaidDay);
        while (cursor <= now) {
          if (!this.isLiburBayar(contract, cursor)) {
            unpaidWorkingDays++;
          }
          cursor.setDate(cursor.getDate() + 1);
        }

        if (unpaidWorkingDays > 0) {
          const periodStart = new Date(firstUnpaidDay);
          periodStart.setHours(0, 0, 0, 0);
          const periodEnd = new Date(now);
          periodEnd.setHours(23, 59, 59, 999);

          const payment: Invoice = {
            id: uuidv4(),
            invoiceNumber: await this.generatePaymentNumber(),
            contractId: contract.id,
            customerId: contract.customerId,
            amount: unpaidWorkingDays * contract.dailyRate,
            lateFee: 0,
            type: InvoiceType.DAILY_BILLING,
            status: PaymentStatus.PENDING,
            qrCodeData: '',
            dueDate: periodEnd,
            paidAt: null,
            extensionDays: unpaidWorkingDays,
            dokuPaymentUrl: null,
            dokuReferenceId: null,
            dailyRate: contract.dailyRate,
            daysCount: unpaidWorkingDays,
            periodStart,
            periodEnd,
            expiredAt: null,
            previousPaymentId: null,
            isHoliday: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await this.invoiceRepo.create(payment);
          generated++;
        }
        continue;
      }

      // firstUnpaidDay === now
      if (this.isLiburBayar(contract, now)) {
        await this.createHolidayPayment(contract, now);
        generated++;
        continue;
      }

      await this.createDailyPayment(contract, now);
      generated++;
    }

    return generated;
  }

  private async createDailyPayment(contract: Contract, usageDate: Date): Promise<Invoice> {
    const periodStart = new Date(usageDate);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(usageDate);
    periodEnd.setHours(23, 59, 59, 999);

    const payment: Invoice = {
      id: uuidv4(),
      invoiceNumber: await this.generatePaymentNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: contract.dailyRate,
      lateFee: 0,
      type: InvoiceType.DAILY_BILLING,
      status: PaymentStatus.PENDING,
      qrCodeData: '',
      dueDate: periodEnd,
      paidAt: null,
      extensionDays: 1,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: contract.dailyRate,
      daysCount: 1,
      periodStart,
      periodEnd,
      expiredAt: null,
      previousPaymentId: null,
      isHoliday: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.invoiceRepo.create(payment);
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

    // Credit 1 free day to contract
    await this.creditDayToContract(contract, 1, true);

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

    // Check if today is a Libur Bayar
    if (this.isLiburBayar(contract, today)) {
      await this.creditDayToContract(contract, 1, true);

      const periodEnd = new Date(today);
      periodEnd.setHours(23, 59, 59, 999);

      const newPayment: Invoice = {
        id: uuidv4(),
        invoiceNumber: await this.generatePaymentNumber(),
        contractId: contract.id,
        customerId: contract.customerId,
        amount: expiredPayment.amount,
        lateFee: 0,
        type: InvoiceType.DAILY_BILLING,
        status: PaymentStatus.PENDING,
        qrCodeData: '',
        dueDate: periodEnd,
        paidAt: null,
        extensionDays: expiredPayment.daysCount,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        dailyRate: contract.dailyRate,
        daysCount: expiredPayment.daysCount!,
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

    // Normal day: add today's rate to accumulated amount
    const newAmount = expiredPayment.amount + contract.dailyRate;
    const newDaysCount = (expiredPayment.daysCount || 0) + 1;

    const periodEnd = new Date(today);
    periodEnd.setHours(23, 59, 59, 999);

    const newPayment: Invoice = {
      id: uuidv4(),
      invoiceNumber: await this.generatePaymentNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: newAmount,
      lateFee: 0,
      type: InvoiceType.DAILY_BILLING,
      status: PaymentStatus.PENDING,
      qrCodeData: '',
      dueDate: periodEnd,
      paidAt: null,
      extensionDays: newDaysCount,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: contract.dailyRate,
      daysCount: newDaysCount,
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

    // Credit days to contract
    if (payment.type === InvoiceType.DAILY_BILLING || payment.type === InvoiceType.MANUAL_PAYMENT) {
      const days = payment.daysCount || payment.extensionDays || 0;
      if (days > 0) {
        await this.creditDayToContract(contract, days, false);
      }
    } else {
      // DP / DP_INSTALLMENT
      await this.applyDPPayment(payment, contract);
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

  // ============ Credit Days to Contract ============

  private async creditDayToContract(contract: Contract, days: number, isHoliday: boolean): Promise<void> {
    const newTotalDaysPaid = contract.totalDaysPaid + days;
    const newProgress = parseFloat(((newTotalDaysPaid / contract.ownershipTargetDays) * 100).toFixed(2));
    const isCompleted = newTotalDaysPaid >= contract.ownershipTargetDays;

    const newEndDate = new Date(contract.endDate);
    if (isHoliday) {
      newEndDate.setDate(newEndDate.getDate() + days);
    } else {
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
      updateData.durationDays = contract.durationDays + days;
    }

    if (isCompleted) {
      updateData.status = ContractStatus.COMPLETED;
      updateData.completedAt = new Date();
    }

    await this.contractRepo.update(contract.id, updateData);
  }

  // ============ Manual Payment ============

  async createManualPayment(contractId: string, days: number, adminId: string): Promise<Invoice> {
    if (days < 1 || days > 7) throw new Error('Manual payment must be 1-7 days');

    const contract = await this.contractRepo.findById(contractId);
    if (!contract) throw new Error('Contract not found');
    if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.OVERDUE) {
      throw new Error('Contract must be ACTIVE or OVERDUE');
    }
    if (!contract.billingStartDate) throw new Error('Billing has not started yet');

    const amount = days * contract.dailyRate;

    const periodStart = new Date(contract.endDate);
    periodStart.setDate(periodStart.getDate() + 1);
    periodStart.setHours(0, 0, 0, 0);

    // Advance by N working days (skipping Libur Bayar)
    let remaining = days;
    const cursor = new Date(periodStart);
    while (remaining > 0) {
      if (!this.isLiburBayar(contract, cursor)) {
        remaining--;
        if (remaining > 0) cursor.setDate(cursor.getDate() + 1);
      } else {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    const periodEnd = new Date(cursor);
    periodEnd.setHours(23, 59, 59, 999);

    // Check for existing active payment
    const existingActive = await this.invoiceRepo.findActiveByContractId(contractId);
    let previousPaymentId: string | null = null;
    let mergedAmount = amount;
    let mergedDaysCount = days;
    let mergedPeriodStart = periodStart;

    if (existingActive) {
      // Cancel existing active payment
      await this.invoiceRepo.update(existingActive.id, {
        status: PaymentStatus.VOID,
      });

      mergedAmount = existingActive.amount + amount;
      mergedDaysCount = (existingActive.daysCount || 0) + days;
      mergedPeriodStart = new Date(existingActive.periodStart!);
      previousPaymentId = existingActive.id;
    }

    const payment: Invoice = {
      id: uuidv4(),
      invoiceNumber: await this.generatePaymentNumber(),
      contractId: contract.id,
      customerId: contract.customerId,
      amount: mergedAmount,
      lateFee: 0,
      type: InvoiceType.MANUAL_PAYMENT,
      status: PaymentStatus.PENDING,
      qrCodeData: '',
      dueDate: periodEnd,
      paidAt: null,
      extensionDays: mergedDaysCount,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: contract.dailyRate,
      daysCount: mergedDaysCount,
      periodStart: mergedPeriodStart,
      periodEnd,
      expiredAt: null,
      previousPaymentId,
      isHoliday: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.invoiceRepo.create(payment);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.CREATE,
      module: 'payment',
      entityId: created.id,
      description: `Manual payment created: ${days} days, Rp ${amount.toLocaleString('id-ID')}${existingActive ? ` (merged with ${existingActive.invoiceNumber})` : ''}`,
      metadata: {
        paymentNumber: created.invoiceNumber,
        days,
        amount: mergedAmount,
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

    // If merged payment, reactivate the previous one
    if (payment.previousPaymentId) {
      const previous = await this.invoiceRepo.findById(payment.previousPaymentId);
      if (previous) {
        await this.invoiceRepo.update(previous.id, {
          status: PaymentStatus.PENDING,
        });
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

    const payments = await this.invoiceRepo.findByContractId(contractId);
    // Filter to daily billing / manual payments only (for calendar)
    const billingPayments = payments.filter(p =>
      p.type === InvoiceType.DAILY_BILLING || p.type === InvoiceType.MANUAL_PAYMENT
    );

    const today = getWibToday();

    const daysInMonth = new Date(year, month, 0).getDate();
    const result: CalendarDay[] = [];

    const billingStart = contract.billingStartDate ? new Date(contract.billingStartDate) : null;
    if (billingStart) billingStart.setHours(0, 0, 0, 0);

    // Collect holiday dates from holiday payments (isHoliday=true or daysCount=0, PAID)
    const holidayDates = new Set<string>();
    billingPayments.filter(p => (p.isHoliday || p.daysCount === 0) && p.status === PaymentStatus.PAID).forEach(p => {
      if (p.periodStart) {
        const d = new Date(p.periodStart);
        holidayDates.add(toDateKey(d));
      }
    });

    let coveredEndDate: Date | null = null;
    if (billingStart && contract.totalDaysPaid > 0) {
      coveredEndDate = new Date(contract.endDate);
      coveredEndDate.setHours(0, 0, 0, 0);
    }

    // Find active (PENDING) billing payment
    const activePayment = billingPayments.find(p => p.status === PaymentStatus.PENDING);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      date.setHours(0, 0, 0, 0);
      const dateKey = toDateKey(date);

      if (!billingStart || date < billingStart) {
        result.push({ date: dateKey, status: 'not_issued' });
        continue;
      }

      if (coveredEndDate && date <= coveredEndDate) {
        if (this.isLiburBayar(contract, date) || holidayDates.has(dateKey)) {
          result.push({ date: dateKey, status: 'holiday' });
        } else {
          result.push({ date: dateKey, status: 'paid' });
        }
        continue;
      }

      if (activePayment && activePayment.periodStart && activePayment.periodEnd) {
        const activeStart = new Date(activePayment.periodStart);
        activeStart.setHours(0, 0, 0, 0);
        const activeEnd = new Date(activePayment.periodEnd);
        activeEnd.setHours(0, 0, 0, 0);

        const isInPeriod = date >= activeStart && date <= activeEnd;
        const isToday = date.getTime() === today.getTime();

        if (isInPeriod || isToday) {
          if (this.isLiburBayar(contract, date)) {
            result.push({ date: dateKey, status: 'holiday' });
          } else if (date < today) {
            result.push({ date: dateKey, status: 'overdue', amount: activePayment.amount });
          } else {
            result.push({ date: dateKey, status: 'pending', amount: activePayment.amount });
          }
          continue;
        }
      }

      if (this.isLiburBayar(contract, date)) {
        result.push({ date: dateKey, status: 'holiday' });
        continue;
      }

      if (date < today) {
        result.push({ date: dateKey, status: 'overdue' });
        continue;
      }

      result.push({ date: dateKey, status: 'not_issued' });
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
      const contract = await this.contractRepo.findById(payment.contractId);
      if (contract) {
        if (payment.type === InvoiceType.DP || payment.type === InvoiceType.DP_INSTALLMENT) {
          await this.applyDPPayment(payment, contract);
        } else {
          const days = payment.daysCount || payment.extensionDays || 0;
          if (days > 0) {
            await this.creditDayToContract(contract, days, false);
          }
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
      await this.revertPaymentFromContract(payment);
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

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
