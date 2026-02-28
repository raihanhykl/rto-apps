import { ICustomerRepository, IAuditLogRepository } from '../../domain/interfaces';
import { Customer } from '../../domain/entities';
import { AuditAction } from '../../domain/enums';
import { CreateCustomerDto, UpdateCustomerDto } from '../dtos';
import { v4 as uuidv4 } from 'uuid';

export class CustomerService {
  constructor(
    private customerRepo: ICustomerRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async getAll(): Promise<Customer[]> {
    return this.customerRepo.findAll();
  }

  async getById(id: string): Promise<Customer> {
    const customer = await this.customerRepo.findById(id);
    if (!customer) throw new Error('Customer not found');
    return customer;
  }

  async search(query: string): Promise<Customer[]> {
    return this.customerRepo.search(query);
  }

  async create(dto: CreateCustomerDto, adminId: string): Promise<Customer> {
    const existingKtp = await this.customerRepo.findByKtpNumber(dto.ktpNumber);
    if (existingKtp) throw new Error('Customer with this KTP already exists');

    const customer: Customer = {
      id: uuidv4(),
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email || '',
      address: dto.address,
      ktpNumber: dto.ktpNumber,
      notes: dto.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await this.customerRepo.create(customer);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.CREATE,
      module: 'customer',
      entityId: created.id,
      description: `Created customer: ${created.fullName}`,
      metadata: { customerName: created.fullName },
      ipAddress: '',
      createdAt: new Date(),
    });

    return created;
  }

  async update(id: string, dto: UpdateCustomerDto, adminId: string): Promise<Customer> {
    const existing = await this.customerRepo.findById(id);
    if (!existing) throw new Error('Customer not found');

    if (dto.ktpNumber && dto.ktpNumber !== existing.ktpNumber) {
      const dup = await this.customerRepo.findByKtpNumber(dto.ktpNumber);
      if (dup) throw new Error('Customer with this KTP already exists');
    }

    const updated = await this.customerRepo.update(id, dto);
    if (!updated) throw new Error('Failed to update customer');

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'customer',
      entityId: id,
      description: `Updated customer: ${updated.fullName}`,
      metadata: { changes: dto },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  async delete(id: string, adminId: string): Promise<void> {
    const existing = await this.customerRepo.findById(id);
    if (!existing) throw new Error('Customer not found');

    await this.customerRepo.delete(id);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.DELETE,
      module: 'customer',
      entityId: id,
      description: `Deleted customer: ${existing.fullName}`,
      metadata: { customerName: existing.fullName },
      ipAddress: '',
      createdAt: new Date(),
    });
  }

  async count(): Promise<number> {
    return this.customerRepo.count();
  }
}
