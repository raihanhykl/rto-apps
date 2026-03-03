import {
  IContractRepository,
  ICustomerRepository,
  IInvoiceRepository,
  IAuditLogRepository,
  PaginationParams,
  PaginatedResult,
} from '../../domain/interfaces';
import { Contract, Invoice, Customer } from '../../domain/entities';
import {
  ContractStatus,
  PaymentStatus,
  AuditAction,
  MOTOR_DAILY_RATES,
  MAX_RENTAL_DAYS,
  DEFAULT_OWNERSHIP_TARGET_DAYS,
  DEFAULT_GRACE_PERIOD_DAYS,
  VALID_STATUS_TRANSITIONS,
} from '../../domain/enums';
import { CreateContractDto, UpdateContractStatusDto, ExtendContractDto, UpdateContractDto, CancelContractDto } from '../dtos';
import { SettingService } from './SettingService';
import { v4 as uuidv4 } from 'uuid';

export class ContractService {
  private static contractCounter = 0;
  private static invoiceCounter = 0;

  constructor(
    private contractRepo: IContractRepository,
    private customerRepo: ICustomerRepository,
    private invoiceRepo: IInvoiceRepository,
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

  async create(dto: CreateContractDto, adminId: string): Promise<{ contract: Contract; invoice: Invoice }> {
    const customer = await this.customerRepo.findById(dto.customerId);
    if (!customer) throw new Error('Customer not found');

    const maxRentalDays = await this.getSetting('max_rental_days', MAX_RENTAL_DAYS);
    if (dto.durationDays > maxRentalDays) {
      throw new Error(`Maximum rental duration is ${maxRentalDays} days`);
    }

    const dailyRate = MOTOR_DAILY_RATES[dto.motorModel];
    const totalAmount = dailyRate * dto.durationDays;

    const startDate = new Date(dto.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + dto.durationDays);

    const contractNumber = this.generateContractNumber();
    const ownershipTargetDays = await this.getSetting('ownership_target_days', DEFAULT_OWNERSHIP_TARGET_DAYS);
    const gracePeriodDays = await this.getSetting('grace_period_days', DEFAULT_GRACE_PERIOD_DAYS);

    const contract: Contract = {
      id: uuidv4(),
      contractNumber,
      customerId: dto.customerId,
      motorModel: dto.motorModel,
      dailyRate,
      durationDays: dto.durationDays,
      totalAmount,
      startDate,
      endDate,
      status: ContractStatus.ACTIVE,
      notes: dto.notes || '',
      createdBy: adminId,
      // RTO fields - totalDaysPaid starts at 0, credited only after payment
      ownershipTargetDays,
      totalDaysPaid: 0,
      ownershipProgress: 0,
      gracePeriodDays,
      repossessedAt: null,
      completedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdContract = await this.contractRepo.create(contract);

    // Auto-generate invoice with extensionDays set so payment credits the days
    const invoiceNumber = this.generateInvoiceNumber();
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 1);

    const invoice: Invoice = {
      id: uuidv4(),
      invoiceNumber,
      contractId: createdContract.id,
      customerId: dto.customerId,
      amount: totalAmount,
      lateFee: 0,
      status: PaymentStatus.PENDING,
      qrCodeData: `WEDISON-PAY-${invoiceNumber}-${totalAmount}`,
      dueDate,
      paidAt: null,
      extensionDays: dto.durationDays,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdInvoice = await this.invoiceRepo.create(invoice);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.CREATE,
      module: 'contract',
      entityId: createdContract.id,
      description: `Created contract ${contractNumber} for ${customer.fullName} - ${dto.motorModel} (${dto.durationDays} days)`,
      metadata: {
        contractNumber,
        motorModel: dto.motorModel,
        totalAmount,
        invoiceNumber,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return { contract: createdContract, invoice: createdInvoice };
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

    // Calculate late fee if contract is overdue
    let lateFee = 0;
    const now = new Date();
    if (existing.endDate < now) {
      const daysOverdue = Math.ceil((now.getTime() - existing.endDate.getTime()) / (1000 * 60 * 60 * 24));
      const lateFeePerDay = await this.getSetting('late_fee_per_day', 10000);
      lateFee = daysOverdue * lateFeePerDay;
    }

    // Generate new invoice for the extension (contract is NOT updated until payment)
    const invoiceNumber = this.generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const invoice: Invoice = {
      id: uuidv4(),
      invoiceNumber,
      contractId: id,
      customerId: existing.customerId,
      amount: extensionAmount,
      lateFee,
      status: PaymentStatus.PENDING,
      qrCodeData: `WEDISON-PAY-${invoiceNumber}-${extensionAmount + lateFee}`,
      dueDate,
      paidAt: null,
      extensionDays: dto.durationDays,
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
    const now = new Date();
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
    const now = new Date();
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

  private generateContractNumber(): string {
    ContractService.contractCounter++;
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const seq = ContractService.contractCounter.toString().padStart(4, '0');
    return `RTO-${y}${m}${d}-${seq}`;
  }

  private generateInvoiceNumber(): string {
    ContractService.invoiceCounter++;
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const seq = ContractService.invoiceCounter.toString().padStart(4, '0');
    return `INV-${y}${m}${d}-${seq}`;
  }
}
