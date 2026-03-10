import {
  IContractRepository,
  ICustomerRepository,
  IInvoiceRepository,
  IAuditLogRepository,
  PaginationParams,
  PaginatedResult,
} from '../../domain/interfaces';
import { Contract, Invoice, Customer } from '../../domain/entities';
import { getWibToday, getWibDateParts } from '../../domain/utils/dateUtils';
import {
  ContractStatus,
  PaymentStatus,
  AuditAction,
  DPScheme,
  InvoiceType,
  HolidayScheme,
  PaymentDayStatus,
  MOTOR_DAILY_RATES,
  DP_AMOUNTS,
  MAX_RENTAL_DAYS,
  DEFAULT_OWNERSHIP_TARGET_DAYS,
  DEFAULT_GRACE_PERIOD_DAYS,
  DEFAULT_HOLIDAY_SCHEME,
  VALID_STATUS_TRANSITIONS,
} from '../../domain/enums';
import { IPaymentDayRepository } from '../../domain/interfaces';
import { PaymentDay } from '../../domain/entities';
import { CreateContractDto, UpdateContractStatusDto, ExtendContractDto, UpdateContractDto, CancelContractDto } from '../dtos';
import { SettingService } from './SettingService';
import { v4 as uuidv4 } from 'uuid';

export class ContractService {
  private static contractCounter = 0;
  private static contractCounterInitialized = false;
  private static invoiceCounter = 0;
  private static invoiceCounterInitialized = false;

  constructor(
    private contractRepo: IContractRepository,
    private customerRepo: ICustomerRepository,
    private invoiceRepo: IInvoiceRepository,
    private paymentDayRepo: IPaymentDayRepository,
    private auditRepo: IAuditLogRepository,
    private settingService?: SettingService
  ) {}

  private async getSetting(key: string, fallback: number): Promise<number> {
    if (!this.settingService) return fallback;
    return this.settingService.getNumberSetting(key, fallback);
  }

  async getAll(includeDeleted = false): Promise<Contract[]> {
    const contracts = await this.contractRepo.findAll();
    return includeDeleted ? contracts : contracts.filter(c => !c.isDeleted);
  }

  async getAllPaginated(params: PaginationParams): Promise<PaginatedResult<Contract>> {
    return this.contractRepo.findAllPaginated(params);
  }

  async getById(id: string): Promise<Contract> {
    const contract = await this.contractRepo.findById(id);
    if (!contract) throw new Error('Contract not found');
    return contract;
  }

  async getDetailById(id: string): Promise<{ contract: Contract; customer: Customer; invoices: Invoice[] }> {
    const contract = await this.contractRepo.findById(id);
    if (!contract) throw new Error('Contract not found');

    const customer = await this.customerRepo.findById(contract.customerId);
    if (!customer) throw new Error('Customer not found');

    const invoices = await this.invoiceRepo.findByContractId(contract.id);

    return { contract, customer, invoices };
  }

  async getByCustomerId(customerId: string): Promise<Contract[]> {
    return this.contractRepo.findByCustomerId(customerId);
  }

  async create(dto: CreateContractDto, adminId: string): Promise<{ contract: Contract; invoices: Invoice[] }> {
    const customer = await this.customerRepo.findById(dto.customerId);
    if (!customer) throw new Error('Customer not found');

    const rateKey = `${dto.motorModel}_${dto.batteryType}`;
    const dailyRate = MOTOR_DAILY_RATES[rateKey];
    if (!dailyRate) throw new Error(`Unknown motor/battery combination: ${rateKey}`);

    const dpAmount = DP_AMOUNTS[rateKey];
    if (!dpAmount) throw new Error(`Unknown DP amount for: ${rateKey}`);

    const startDate = new Date(dto.startDate);

    const contractNumber = await this.generateContractNumber();
    const ownershipTargetDays = await this.getSetting('ownership_target_days', DEFAULT_OWNERSHIP_TARGET_DAYS);
    const gracePeriodDays = await this.getSetting('grace_period_days', DEFAULT_GRACE_PERIOD_DAYS);

    const contract: Contract = {
      id: uuidv4(),
      contractNumber,
      customerId: dto.customerId,
      motorModel: dto.motorModel,
      batteryType: dto.batteryType,
      dailyRate,
      durationDays: 0, // will accumulate via daily billing
      totalAmount: 0, // will accumulate via payments
      startDate,
      endDate: startDate, // will update when billing starts
      status: ContractStatus.ACTIVE,
      notes: dto.notes || '',
      createdBy: adminId,
      // Unit details
      color: dto.color || '',
      year: dto.year || null,
      vinNumber: dto.vinNumber || '',
      engineNumber: dto.engineNumber || '',
      // DP fields
      dpAmount,
      dpScheme: dto.dpScheme,
      dpPaidAmount: 0,
      dpFullyPaid: false,
      // Unit delivery & billing (not yet received)
      unitReceivedDate: null,
      billingStartDate: null,
      bastPhoto: null,
      bastNotes: '',
      holidayScheme: dto.holidayScheme || DEFAULT_HOLIDAY_SCHEME,
      // RTO fields
      ownershipTargetDays,
      totalDaysPaid: 0,
      workingDaysPaid: 0,
      holidayDaysPaid: 0,
      ownershipProgress: 0,
      gracePeriodDays,
      savingBalance: 0,
      repossessedAt: null,
      completedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdContract = await this.contractRepo.create(contract);

    // Generate DP invoice(s) based on dpScheme
    const invoices: Invoice[] = [];
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 1);

    if (dto.dpScheme === DPScheme.FULL) {
      // Single DP invoice for full amount
      const invoiceNumber = await this.generateInvoiceNumber();
      const invoice: Invoice = {
        id: uuidv4(),
        invoiceNumber,
        contractId: createdContract.id,
        customerId: dto.customerId,
        amount: dpAmount,
        lateFee: 0,
        type: InvoiceType.DP,
        status: PaymentStatus.PENDING,
        qrCodeData: `WEDISON-PAY-${invoiceNumber}-${dpAmount}`,
        dueDate,
        paidAt: null,
        extensionDays: null, // DP doesn't extend days
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        dailyRate: null,
        daysCount: null,
        periodStart: null,
        periodEnd: null,
        expiredAt: null,
        previousPaymentId: null,
        isHoliday: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      invoices.push(await this.invoiceRepo.create(invoice));
    } else {
      // INSTALLMENT: 2 invoices, 1st = ceil(dp/2), 2nd = floor(dp/2)
      const firstAmount = Math.ceil(dpAmount / 2);
      const secondAmount = Math.floor(dpAmount / 2);

      const inv1Number = await this.generateInvoiceNumber();
      const invoice1: Invoice = {
        id: uuidv4(),
        invoiceNumber: inv1Number,
        contractId: createdContract.id,
        customerId: dto.customerId,
        amount: firstAmount,
        lateFee: 0,
        type: InvoiceType.DP_INSTALLMENT,
        status: PaymentStatus.PENDING,
        qrCodeData: `WEDISON-PAY-${inv1Number}-${firstAmount}`,
        dueDate,
        paidAt: null,
        extensionDays: null,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        dailyRate: null,
        daysCount: null,
        periodStart: null,
        periodEnd: null,
        expiredAt: null,
        previousPaymentId: null,
        isHoliday: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      invoices.push(await this.invoiceRepo.create(invoice1));

      const inv2Number = await this.generateInvoiceNumber();
      const dueDate2 = new Date(dueDate);
      dueDate2.setDate(dueDate2.getDate() + 7); // 2nd installment due 1 week later
      const invoice2: Invoice = {
        id: uuidv4(),
        invoiceNumber: inv2Number,
        contractId: createdContract.id,
        customerId: dto.customerId,
        amount: secondAmount,
        lateFee: 0,
        type: InvoiceType.DP_INSTALLMENT,
        status: PaymentStatus.PENDING,
        qrCodeData: `WEDISON-PAY-${inv2Number}-${secondAmount}`,
        dueDate: dueDate2,
        paidAt: null,
        extensionDays: null,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        dailyRate: null,
        daysCount: null,
        periodStart: null,
        periodEnd: null,
        expiredAt: null,
        previousPaymentId: null,
        isHoliday: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      invoices.push(await this.invoiceRepo.create(invoice2));
    }

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.CREATE,
      module: 'contract',
      entityId: createdContract.id,
      description: `Created contract ${contractNumber} for ${customer.fullName} - ${dto.motorModel} ${dto.batteryType} (DP: ${dto.dpScheme})`,
      metadata: {
        contractNumber,
        motorModel: dto.motorModel,
        batteryType: dto.batteryType,
        dpScheme: dto.dpScheme,
        dpAmount,
        dailyRate,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return { contract: createdContract, invoices };
  }

  async receiveUnit(id: string, adminId: string, bastPhoto: string, bastNotes?: string): Promise<Contract> {
    const existing = await this.contractRepo.findById(id);
    if (!existing) throw new Error('Contract not found');

    if (existing.status !== ContractStatus.ACTIVE) {
      throw new Error('Only ACTIVE contracts can receive unit');
    }

    if (existing.unitReceivedDate !== null) {
      throw new Error('Unit already received for this contract');
    }

    if (!bastPhoto) {
      throw new Error('Foto BAST wajib dilampirkan saat serah terima unit');
    }

    // Validate DP payment - check dpFullyPaid flag first, then verify against invoices
    if (!existing.dpFullyPaid) {
      const invoices = await this.invoiceRepo.findByContractId(id);
      const dpInvoices = invoices.filter(i => i.type === InvoiceType.DP || i.type === InvoiceType.DP_INSTALLMENT);

      if (existing.dpScheme === DPScheme.FULL) {
        const dpInvoice = dpInvoices.find(i => i.type === InvoiceType.DP);
        if (!dpInvoice || dpInvoice.status !== PaymentStatus.PAID) {
          throw new Error('DP harus dibayar lunas sebelum unit bisa diterima');
        }
      } else {
        // INSTALLMENT: at least 1st installment must be paid
        const sortedDpInvoices = dpInvoices
          .filter(i => i.type === InvoiceType.DP_INSTALLMENT)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        if (sortedDpInvoices.length === 0 || sortedDpInvoices[0].status !== PaymentStatus.PAID) {
          throw new Error('DP cicilan pertama harus dibayar sebelum unit bisa diterima');
        }
      }
    }

    const today = getWibToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const updated = await this.contractRepo.update(id, {
      unitReceivedDate: today,
      billingStartDate: tomorrow,
      bastPhoto,
      bastNotes: bastNotes || '',
    });
    if (!updated) throw new Error('Failed to update contract');

    // Generate PaymentDay records for 60 days from billingStartDate
    const records: PaymentDay[] = [];
    const cursor = new Date(tomorrow);
    for (let i = 0; i < 60; i++) {
      const d = new Date(cursor);
      d.setHours(0, 0, 0, 0);
      const isSunday = d.getDay() === 0;
      const isDate29Plus = d.getDate() > 28;
      const isHoliday = existing.holidayScheme === HolidayScheme.OLD_CONTRACT ? isSunday : isDate29Plus;

      records.push({
        id: uuidv4(),
        contractId: existing.id,
        date: d,
        status: isHoliday ? PaymentDayStatus.HOLIDAY : PaymentDayStatus.UNPAID,
        paymentId: null,
        dailyRate: existing.dailyRate,
        amount: isHoliday ? 0 : existing.dailyRate,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      cursor.setDate(cursor.getDate() + 1);
    }
    if (records.length > 0) {
      await this.paymentDayRepo.createMany(records);
    }

    const customer = await this.customerRepo.findById(existing.customerId);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'contract',
      entityId: id,
      description: `Unit received for contract ${existing.contractNumber} (${customer?.fullName || 'Unknown'}) - billing starts ${tomorrow.toISOString().split('T')[0]}`,
      metadata: {
        contractNumber: existing.contractNumber,
        unitReceivedDate: today,
        billingStartDate: tomorrow,
        bastPhoto,
        bastNotes: bastNotes || '',
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  async extend(id: string, dto: ExtendContractDto, adminId: string): Promise<{ contract: Contract; invoice: Invoice }> {
    const existing = await this.contractRepo.findById(id);
    if (!existing) throw new Error('Contract not found');

    if (existing.status !== ContractStatus.ACTIVE && existing.status !== ContractStatus.OVERDUE) {
      throw new Error('Only ACTIVE or OVERDUE contracts can be extended');
    }

    // Block extension if there are unpaid pending invoices
    const existingInvoices = await this.invoiceRepo.findByContractId(id);
    const hasPending = existingInvoices.some(inv => inv.status === PaymentStatus.PENDING);
    if (hasPending) {
      throw new Error('Tidak bisa perpanjang: masih ada invoice yang belum dibayar. Bayar atau void terlebih dahulu.');
    }

    const maxRentalDays = await this.getSetting('max_rental_days', MAX_RENTAL_DAYS);
    if (dto.durationDays > maxRentalDays) {
      throw new Error(`Maximum extension is ${maxRentalDays} days`);
    }

    const extensionAmount = existing.dailyRate * dto.durationDays;

    // Calculate late fee only if contract status is OVERDUE and billing has started
    let lateFee = 0;
    const now = getWibToday();
    if (existing.status === ContractStatus.OVERDUE && existing.billingStartDate) {
      const daysOverdue = Math.ceil((now.getTime() - existing.endDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue > 0) {
        const lateFeePerDay = await this.getSetting('late_fee_per_day', 10000);
        lateFee = daysOverdue * lateFeePerDay;
      }
    }

    // Generate new invoice for the extension (contract is NOT updated until payment)
    const invoiceNumber = await this.generateInvoiceNumber();
    const dueDate = getWibToday();
    dueDate.setDate(dueDate.getDate() + 1);

    const invoice: Invoice = {
      id: uuidv4(),
      invoiceNumber,
      contractId: id,
      customerId: existing.customerId,
      amount: extensionAmount,
      lateFee,
      type: InvoiceType.MANUAL_PAYMENT,
      status: PaymentStatus.PENDING,
      qrCodeData: `WEDISON-PAY-${invoiceNumber}-${extensionAmount + lateFee}`,
      dueDate,
      paidAt: null,
      extensionDays: dto.durationDays,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      dailyRate: null,
      daysCount: null,
      periodStart: null,
      periodEnd: null,
      expiredAt: null,
      previousPaymentId: null,
      isHoliday: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdInvoice = await this.invoiceRepo.create(invoice);

    const customer = await this.customerRepo.findById(existing.customerId);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'contract',
      entityId: id,
      description: `Extension requested for contract ${existing.contractNumber} - ${dto.durationDays} days for ${customer?.fullName || 'Unknown'} (pending payment)${lateFee > 0 ? ` + late fee Rp ${lateFee.toLocaleString('id-ID')}` : ''}`,
      metadata: {
        extensionDays: dto.durationDays,
        extensionAmount,
        lateFee,
        invoiceNumber,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return { contract: existing, invoice: createdInvoice };
  }

  async repossess(id: string, adminId: string): Promise<Contract> {
    const existing = await this.contractRepo.findById(id);
    if (!existing) throw new Error('Contract not found');

    if (existing.status === ContractStatus.COMPLETED) {
      throw new Error('Cannot repossess a completed contract');
    }
    if (existing.status === ContractStatus.REPOSSESSED) {
      throw new Error('Contract already repossessed');
    }
    if (existing.status === ContractStatus.CANCELLED) {
      throw new Error('Cannot repossess a cancelled contract');
    }

    // Auto-void all PENDING/FAILED invoices
    const invoices = await this.invoiceRepo.findByContractId(id);
    for (const inv of invoices) {
      if (inv.status === PaymentStatus.PENDING || inv.status === PaymentStatus.FAILED) {
        await this.invoiceRepo.update(inv.id, { status: PaymentStatus.VOID });
      }
    }

    // Void all UNPAID and PENDING PaymentDays
    const unpaidDays = await this.paymentDayRepo.findByContractAndStatus(id, PaymentDayStatus.UNPAID);
    const pendingDays = await this.paymentDayRepo.findByContractAndStatus(id, PaymentDayStatus.PENDING);
    for (const day of [...unpaidDays, ...pendingDays]) {
      await this.paymentDayRepo.update(day.id, {
        status: PaymentDayStatus.VOIDED,
        paymentId: null,
      });
    }

    const updated = await this.contractRepo.update(id, {
      status: ContractStatus.REPOSSESSED,
      repossessedAt: new Date(),
    });
    if (!updated) throw new Error('Failed to update contract');

    const customer = await this.customerRepo.findById(existing.customerId);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'contract',
      entityId: id,
      description: `Repossessed motor for contract ${existing.contractNumber} (${customer?.fullName || 'Unknown'}) - ${existing.motorModel}`,
      metadata: {
        contractNumber: existing.contractNumber,
        motorModel: existing.motorModel,
        totalDaysPaid: existing.totalDaysPaid,
        ownershipProgress: existing.ownershipProgress,
        voidedInvoices: invoices.filter(i => i.status === PaymentStatus.PENDING || i.status === PaymentStatus.FAILED).length,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  async editContract(id: string, dto: UpdateContractDto, adminId: string): Promise<Contract> {
    const existing = await this.contractRepo.findById(id);
    if (!existing) throw new Error('Contract not found');

    const updateData: Partial<Contract> = {};
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.gracePeriodDays !== undefined) updateData.gracePeriodDays = dto.gracePeriodDays;
    if (dto.ownershipTargetDays !== undefined) {
      updateData.ownershipTargetDays = dto.ownershipTargetDays;
      updateData.ownershipProgress = parseFloat(((existing.totalDaysPaid / dto.ownershipTargetDays) * 100).toFixed(2));
    }
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.year !== undefined) updateData.year = dto.year;
    if (dto.vinNumber !== undefined) updateData.vinNumber = dto.vinNumber;
    if (dto.engineNumber !== undefined) updateData.engineNumber = dto.engineNumber;

    const updated = await this.contractRepo.update(id, updateData);
    if (!updated) throw new Error('Failed to update contract');

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'contract',
      entityId: id,
      description: `Edited contract ${existing.contractNumber}`,
      metadata: { changes: dto },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  async cancelContract(id: string, dto: CancelContractDto, adminId: string): Promise<Contract> {
    const existing = await this.contractRepo.findById(id);
    if (!existing) throw new Error('Contract not found');

    if (existing.status === ContractStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed contract');
    }
    if (existing.status === ContractStatus.CANCELLED) {
      throw new Error('Contract already cancelled');
    }
    if (existing.status === ContractStatus.REPOSSESSED) {
      throw new Error('Cannot cancel a repossessed contract');
    }

    // Auto-void all PENDING/FAILED invoices
    const invoices = await this.invoiceRepo.findByContractId(id);
    for (const inv of invoices) {
      if (inv.status === PaymentStatus.PENDING || inv.status === PaymentStatus.FAILED) {
        await this.invoiceRepo.update(inv.id, { status: PaymentStatus.VOID });
      }
    }

    // Void all UNPAID and PENDING PaymentDays
    const unpaidDays = await this.paymentDayRepo.findByContractAndStatus(id, PaymentDayStatus.UNPAID);
    const pendingDays = await this.paymentDayRepo.findByContractAndStatus(id, PaymentDayStatus.PENDING);
    for (const day of [...unpaidDays, ...pendingDays]) {
      await this.paymentDayRepo.update(day.id, {
        status: PaymentDayStatus.VOIDED,
        paymentId: null,
      });
    }

    const updated = await this.contractRepo.update(id, {
      status: ContractStatus.CANCELLED,
      notes: existing.notes ? `${existing.notes}\n[CANCELLED] ${dto.reason}` : `[CANCELLED] ${dto.reason}`,
    });
    if (!updated) throw new Error('Failed to update contract');

    const customer = await this.customerRepo.findById(existing.customerId);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'contract',
      entityId: id,
      description: `Cancelled contract ${existing.contractNumber} (${customer?.fullName || 'Unknown'}) - Reason: ${dto.reason}`,
      metadata: {
        reason: dto.reason,
        previousStatus: existing.status,
        voidedInvoices: invoices.filter(i => i.status === PaymentStatus.PENDING || i.status === PaymentStatus.FAILED).length,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  async softDelete(id: string, adminId: string): Promise<Contract> {
    const existing = await this.contractRepo.findById(id);
    if (!existing) throw new Error('Contract not found');

    if (existing.isDeleted) {
      throw new Error('Contract already deleted');
    }

    if (existing.status === ContractStatus.ACTIVE || existing.status === ContractStatus.OVERDUE) {
      throw new Error('Cannot delete an active or overdue contract. Cancel it first.');
    }

    const updated = await this.contractRepo.update(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });
    if (!updated) throw new Error('Failed to delete contract');

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.DELETE,
      module: 'contract',
      entityId: id,
      description: `Soft-deleted contract ${existing.contractNumber}`,
      metadata: { contractNumber: existing.contractNumber, previousStatus: existing.status },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  async checkAndUpdateOverdueContracts(): Promise<number> {
    const activeContracts = await this.contractRepo.findByStatus(ContractStatus.ACTIVE);
    const now = getWibToday();
    let overdueCount = 0;

    for (const contract of activeContracts) {
      // Only mark overdue after grace period has expired
      const graceEnd = new Date(contract.endDate);
      graceEnd.setDate(graceEnd.getDate() + contract.gracePeriodDays);

      if (graceEnd < now) {
        await this.contractRepo.update(contract.id, {
          status: ContractStatus.OVERDUE,
        });

        // Audit log for automated overdue transition
        await this.auditRepo.create({
          id: uuidv4(),
          userId: 'system',
          action: AuditAction.UPDATE,
          module: 'contract',
          entityId: contract.id,
          description: `Contract ${contract.contractNumber} auto-marked as OVERDUE (end date + grace period exceeded)`,
          metadata: {
            contractNumber: contract.contractNumber,
            endDate: contract.endDate,
            gracePeriodDays: contract.gracePeriodDays,
          },
          ipAddress: '',
          createdAt: new Date(),
        });

        overdueCount++;
      }
    }

    return overdueCount;
  }

  async getOverdueWarnings(): Promise<Array<{ contract: Contract; customer: Customer; daysOverdue: number; graceRemaining: number }>> {
    const overdueContracts = await this.contractRepo.findByStatus(ContractStatus.OVERDUE);
    const activeContracts = await this.contractRepo.findByStatus(ContractStatus.ACTIVE);
    const now = getWibToday();
    const warnings: Array<{ contract: Contract; customer: Customer; daysOverdue: number; graceRemaining: number }> = [];

    // Check overdue contracts
    for (const contract of overdueContracts) {
      const customer = await this.customerRepo.findById(contract.customerId);
      if (!customer) continue;

      const daysOverdue = Math.floor((now.getTime() - contract.endDate.getTime()) / (1000 * 60 * 60 * 24));
      const graceRemaining = Math.max(0, contract.gracePeriodDays - daysOverdue);

      warnings.push({ contract, customer, daysOverdue, graceRemaining });
    }

    // Check active contracts nearing end date (within 2 days)
    for (const contract of activeContracts) {
      const daysUntilEnd = Math.floor((contract.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilEnd <= 2 && daysUntilEnd >= 0) {
        const customer = await this.customerRepo.findById(contract.customerId);
        if (!customer) continue;

        warnings.push({ contract, customer, daysOverdue: -daysUntilEnd, graceRemaining: contract.gracePeriodDays + daysUntilEnd });
      }
    }

    return warnings;
  }

  async updateStatus(id: string, dto: UpdateContractStatusDto, adminId: string): Promise<Contract> {
    const existing = await this.contractRepo.findById(id);
    if (!existing) throw new Error('Contract not found');

    // Validate status transition
    const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status];
    if (!allowedTransitions.includes(dto.status)) {
      throw new Error(`Invalid status transition from ${existing.status} to ${dto.status}`);
    }

    const updated = await this.contractRepo.update(id, { status: dto.status });
    if (!updated) throw new Error('Failed to update contract');

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'contract',
      entityId: id,
      description: `Updated contract ${existing.contractNumber} status to ${dto.status}`,
      metadata: { previousStatus: existing.status, newStatus: dto.status },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  async count(): Promise<number> {
    return this.contractRepo.count();
  }

  async countByStatus(status: ContractStatus): Promise<number> {
    return this.contractRepo.countByStatus(status);
  }

  private async initContractCounter(): Promise<void> {
    if (!ContractService.contractCounterInitialized) {
      const maxSeq = await this.contractRepo.findMaxContractSequence();
      ContractService.contractCounter = maxSeq;
      ContractService.contractCounterInitialized = true;
    }
  }

  private static readonly ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  private async generateContractNumber(): Promise<string> {
    await this.initContractCounter();
    ContractService.contractCounter++;
    const { year, month } = getWibDateParts();
    const romanMonth = ContractService.ROMAN_MONTHS[month - 1];
    return `${ContractService.contractCounter}/WNUS-KTR/${romanMonth}/${year}`;
  }

  private async generateInvoiceNumber(): Promise<string> {
    if (!ContractService.invoiceCounterInitialized) {
      const maxSeq = await this.invoiceRepo.findMaxInvoiceSequence();
      ContractService.invoiceCounter = maxSeq;
      ContractService.invoiceCounterInitialized = true;
    }
    ContractService.invoiceCounter++;
    const { year, month, day } = getWibDateParts();
    const y = year.toString().slice(-2);
    const m = month.toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    const seq = ContractService.invoiceCounter.toString().padStart(4, '0');
    return `PMT-${y}${m}${d}-${seq}`;
  }
}
