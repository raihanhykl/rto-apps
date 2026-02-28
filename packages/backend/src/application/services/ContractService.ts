import {
  IContractRepository,
  ICustomerRepository,
  IInvoiceRepository,
  IAuditLogRepository,
} from '../../domain/interfaces';
import { Contract, Invoice, Customer } from '../../domain/entities';
import {
  ContractStatus,
  PaymentStatus,
  AuditAction,
  MOTOR_DAILY_RATES,
  MAX_RENTAL_DAYS,
} from '../../domain/enums';
import { CreateContractDto, UpdateContractStatusDto } from '../dtos';
import { v4 as uuidv4 } from 'uuid';

export class ContractService {
  constructor(
    private contractRepo: IContractRepository,
    private customerRepo: ICustomerRepository,
    private invoiceRepo: IInvoiceRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async getAll(): Promise<Contract[]> {
    return this.contractRepo.findAll();
  }

  async getById(id: string): Promise<Contract> {
    const contract = await this.contractRepo.findById(id);
    if (!contract) throw new Error('Contract not found');
    return contract;
  }

  async getDetailById(id: string): Promise<{ contract: Contract; customer: Customer; invoice: Invoice | null }> {
    const contract = await this.contractRepo.findById(id);
    if (!contract) throw new Error('Contract not found');

    const customer = await this.customerRepo.findById(contract.customerId);
    if (!customer) throw new Error('Customer not found');

    const invoice = await this.invoiceRepo.findByContractId(contract.id);

    return { contract, customer, invoice };
  }

  async getByCustomerId(customerId: string): Promise<Contract[]> {
    return this.contractRepo.findByCustomerId(customerId);
  }

  async create(dto: CreateContractDto, adminId: string): Promise<{ contract: Contract; invoice: Invoice }> {
    const customer = await this.customerRepo.findById(dto.customerId);
    if (!customer) throw new Error('Customer not found');

    if (dto.durationDays > MAX_RENTAL_DAYS) {
      throw new Error(`Maximum rental duration is ${MAX_RENTAL_DAYS} days`);
    }

    const dailyRate = MOTOR_DAILY_RATES[dto.motorModel];
    const totalAmount = dailyRate * dto.durationDays;

    const startDate = new Date(dto.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + dto.durationDays);

    const contractNumber = this.generateContractNumber();

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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createdContract = await this.contractRepo.create(contract);

    // Auto-generate invoice
    const invoiceNumber = this.generateInvoiceNumber();
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 1); // Due 1 day after start

    const invoice: Invoice = {
      id: uuidv4(),
      invoiceNumber,
      contractId: createdContract.id,
      customerId: dto.customerId,
      amount: totalAmount,
      status: PaymentStatus.PENDING,
      qrCodeData: `WEDISON-PAY-${invoiceNumber}-${totalAmount}`,
      dueDate,
      paidAt: null,
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

  async updateStatus(id: string, dto: UpdateContractStatusDto, adminId: string): Promise<Contract> {
    const existing = await this.contractRepo.findById(id);
    if (!existing) throw new Error('Contract not found');

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
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RTO-${y}${m}${d}-${rand}`;
  }

  private generateInvoiceNumber(): string {
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${y}${m}${d}-${rand}`;
  }
}
