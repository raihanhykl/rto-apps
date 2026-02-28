import { ContractService } from '../application/services/ContractService';
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryCustomerRepository } from '../infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '../infrastructure/repositories/InMemoryInvoiceRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import { MotorModel, ContractStatus, PaymentStatus } from '../domain/enums';
import { v4 as uuidv4 } from 'uuid';

describe('ContractService', () => {
  let contractService: ContractService;
  let contractRepo: InMemoryContractRepository;
  let customerRepo: InMemoryCustomerRepository;
  let invoiceRepo: InMemoryInvoiceRepository;
  let auditRepo: InMemoryAuditLogRepository;
  let customerId: string;
  const adminId = 'admin-1';

  beforeEach(async () => {
    contractRepo = new InMemoryContractRepository();
    customerRepo = new InMemoryCustomerRepository();
    invoiceRepo = new InMemoryInvoiceRepository();
    auditRepo = new InMemoryAuditLogRepository();
    contractService = new ContractService(contractRepo, customerRepo, invoiceRepo, auditRepo);

    // Seed a customer
    customerId = uuidv4();
    await customerRepo.create({
      id: customerId,
      fullName: 'Budi Santoso',
      phone: '081234567890',
      email: 'budi@example.com',
      address: 'Jakarta',
      ktpNumber: '3201011234567890',
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('create', () => {
    it('should create contract with correct total amount for Athena', async () => {
      const result = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      expect(result.contract.totalAmount).toBe(55000 * 3);
      expect(result.contract.dailyRate).toBe(55000);
      expect(result.contract.status).toBe(ContractStatus.ACTIVE);
    });

    it('should create contract with correct total amount for EdPower', async () => {
      const result = await contractService.create({
        customerId,
        motorModel: MotorModel.EDPOWER,
        durationDays: 5,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      expect(result.contract.totalAmount).toBe(75000 * 5);
      expect(result.contract.dailyRate).toBe(75000);
    });

    it('should auto-generate invoice', async () => {
      const result = await contractService.create({
        customerId,
        motorModel: MotorModel.VICTORY,
        durationDays: 2,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      expect(result.invoice).toBeDefined();
      expect(result.invoice.amount).toBe(55000 * 2);
      expect(result.invoice.status).toBe(PaymentStatus.PENDING);
      expect(result.invoice.contractId).toBe(result.contract.id);
    });

    it('should reject duration exceeding max rental days', async () => {
      await expect(
        contractService.create({
          customerId,
          motorModel: MotorModel.ATHENA,
          durationDays: 8,
          startDate: '2026-03-01',
          notes: '',
        }, adminId)
      ).rejects.toThrow('Maximum rental duration is 7 days');
    });

    it('should reject if customer not found', async () => {
      await expect(
        contractService.create({
          customerId: 'non-existent',
          motorModel: MotorModel.ATHENA,
          durationDays: 3,
          startDate: '2026-03-01',
          notes: '',
        }, adminId)
      ).rejects.toThrow('Customer not found');
    });

    it('should calculate correct end date', async () => {
      const result = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 5,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      const startDate = new Date('2026-03-01');
      const expectedEnd = new Date(startDate);
      expectedEnd.setDate(expectedEnd.getDate() + 5);

      expect(result.contract.endDate.getTime()).toBe(expectedEnd.getTime());
    });

    it('should generate contract number with RTO prefix', async () => {
      const result = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      expect(result.contract.contractNumber).toMatch(/^RTO-\d{6}-\d{4}$/);
    });

    it('should create audit log', async () => {
      await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('CREATE');
      expect(logs[0].module).toBe('contract');
    });
  });

  describe('updateStatus', () => {
    it('should update contract status', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      const updated = await contractService.updateStatus(
        contract.id,
        { status: ContractStatus.COMPLETED },
        adminId
      );

      expect(updated.status).toBe(ContractStatus.COMPLETED);
    });

    it('should throw if contract not found', async () => {
      await expect(
        contractService.updateStatus('non-existent', { status: ContractStatus.CANCELLED }, adminId)
      ).rejects.toThrow('Contract not found');
    });
  });

  describe('getDetailById', () => {
    it('should return contract with customer and invoice', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      const detail = await contractService.getDetailById(contract.id);
      expect(detail.contract.id).toBe(contract.id);
      expect(detail.customer.id).toBe(customerId);
      expect(detail.invoice).not.toBeNull();
    });

    it('should throw if contract not found', async () => {
      await expect(contractService.getDetailById('non-existent')).rejects.toThrow('Contract not found');
    });
  });

  describe('getByCustomerId', () => {
    it('should return contracts for a customer', async () => {
      await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);
      await contractService.create({
        customerId,
        motorModel: MotorModel.VICTORY,
        durationDays: 2,
        startDate: '2026-03-05',
        notes: '',
      }, adminId);

      const contracts = await contractService.getByCustomerId(customerId);
      expect(contracts.length).toBe(2);
    });
  });
});
