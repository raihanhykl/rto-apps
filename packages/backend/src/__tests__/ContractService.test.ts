import { ContractService } from '../application/services/ContractService';
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryCustomerRepository } from '../infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '../infrastructure/repositories/InMemoryInvoiceRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import { MotorModel, ContractStatus, PaymentStatus, DEFAULT_OWNERSHIP_TARGET_DAYS, DEFAULT_GRACE_PERIOD_DAYS } from '../domain/enums';
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
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // Helper: pay the initial invoice so extend() is not blocked
  async function payInitialInvoice(contractId: string) {
    const invoices = await invoiceRepo.findByContractId(contractId);
    const initial = invoices.find(i => i.status === PaymentStatus.PENDING);
    if (initial) {
      await invoiceRepo.update(initial.id, { status: PaymentStatus.PAID, paidAt: new Date() });
    }
  }

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

    it('should auto-generate invoice with extensionDays', async () => {
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
      expect(result.invoice.extensionDays).toBe(2);
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

    // RTO-specific tests
    it('should initialize RTO fields with totalDaysPaid=0 and ownershipProgress=0', async () => {
      const result = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 5,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      expect(result.contract.ownershipTargetDays).toBe(DEFAULT_OWNERSHIP_TARGET_DAYS);
      expect(result.contract.totalDaysPaid).toBe(0);
      expect(result.contract.ownershipProgress).toBe(0);
      expect(result.contract.gracePeriodDays).toBe(DEFAULT_GRACE_PERIOD_DAYS);
      expect(result.contract.repossessedAt).toBeNull();
      expect(result.contract.completedAt).toBeNull();
    });
  });

  describe('extend', () => {
    it('should create extension invoice without updating contract', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      // Pay initial invoice first (extension blocked if pending invoices exist)
      await payInitialInvoice(contract.id);

      const result = await contractService.extend(contract.id, { durationDays: 5 }, adminId);

      // Contract should NOT be updated yet (pending extension payment)
      expect(result.contract.totalDaysPaid).toBe(0); // unchanged (initial payment doesn't go through ContractService)
      expect(result.contract.durationDays).toBe(3); // unchanged
      expect(result.contract.totalAmount).toBe(55000 * 3); // unchanged
      // Invoice should be created with extension info
      expect(result.invoice.amount).toBe(55000 * 5);
      expect(result.invoice.extensionDays).toBe(5);
      expect(result.invoice.status).toBe(PaymentStatus.PENDING);
    });

    it('should generate new invoice for extension', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await payInitialInvoice(contract.id);
      await contractService.extend(contract.id, { durationDays: 7 }, adminId);

      const invoices = await invoiceRepo.findByContractId(contract.id);
      expect(invoices.length).toBe(2); // initial + extension
    });

    it('should reject extending a completed contract', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await contractRepo.update(contract.id, { status: ContractStatus.COMPLETED });

      await expect(
        contractService.extend(contract.id, { durationDays: 3 }, adminId)
      ).rejects.toThrow('Only ACTIVE or OVERDUE contracts can be extended');
    });

    it('should reject extending beyond max rental days', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await payInitialInvoice(contract.id);

      await expect(
        contractService.extend(contract.id, { durationDays: 8 }, adminId)
      ).rejects.toThrow('Maximum extension is 7 days');
    });

    it('should allow extending overdue contracts', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await payInitialInvoice(contract.id);
      await contractRepo.update(contract.id, { status: ContractStatus.OVERDUE });

      const result = await contractService.extend(contract.id, { durationDays: 5 }, adminId);
      // Contract status NOT changed yet (pending payment)
      expect(result.contract.status).toBe(ContractStatus.OVERDUE);
      expect(result.invoice.extensionDays).toBe(5);
    });

    it('should reject extension when pending invoice exists', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      // Initial invoice is still PENDING, so extension should be blocked
      await expect(
        contractService.extend(contract.id, { durationDays: 5 }, adminId)
      ).rejects.toThrow('masih ada invoice yang belum dibayar');
    });
  });

  describe('repossess', () => {
    it('should repossess an active contract', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      const result = await contractService.repossess(contract.id, adminId);
      expect(result.status).toBe(ContractStatus.REPOSSESSED);
      expect(result.repossessedAt).not.toBeNull();
    });

    it('should auto-void pending invoices on repossess', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await contractService.repossess(contract.id, adminId);

      const invoices = await invoiceRepo.findByContractId(contract.id);
      const pendingInvoices = invoices.filter(i => i.status === PaymentStatus.PENDING);
      expect(pendingInvoices.length).toBe(0);
      const voidedInvoices = invoices.filter(i => i.status === PaymentStatus.VOID);
      expect(voidedInvoices.length).toBe(1);
    });

    it('should reject repossessing a completed contract', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await contractRepo.update(contract.id, { status: ContractStatus.COMPLETED });

      await expect(
        contractService.repossess(contract.id, adminId)
      ).rejects.toThrow('Cannot repossess a completed contract');
    });

    it('should reject repossessing an already repossessed contract', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await contractService.repossess(contract.id, adminId);

      await expect(
        contractService.repossess(contract.id, adminId)
      ).rejects.toThrow('Contract already repossessed');
    });

    it('should create audit log for repossession', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await contractService.repossess(contract.id, adminId);

      const logs = await auditRepo.findAll();
      const repossessLog = logs.find(l => l.description.includes('Repossessed'));
      expect(repossessLog).toBeDefined();
    });
  });

  describe('updateStatus', () => {
    it('should update contract status with valid transition', async () => {
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

    it('should reject invalid status transition', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await contractRepo.update(contract.id, { status: ContractStatus.COMPLETED });

      await expect(
        contractService.updateStatus(contract.id, { status: ContractStatus.ACTIVE }, adminId)
      ).rejects.toThrow('Invalid status transition');
    });

    it('should throw if contract not found', async () => {
      await expect(
        contractService.updateStatus('non-existent', { status: ContractStatus.CANCELLED }, adminId)
      ).rejects.toThrow('Contract not found');
    });
  });

  describe('getDetailById', () => {
    it('should return contract with customer and invoices', async () => {
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
      expect(detail.invoices.length).toBe(1);
    });

    it('should return multiple invoices after extension', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await payInitialInvoice(contract.id);
      await contractService.extend(contract.id, { durationDays: 5 }, adminId);

      const detail = await contractService.getDetailById(contract.id);
      expect(detail.invoices.length).toBe(2);
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

  describe('editContract', () => {
    it('should update notes', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      const updated = await contractService.editContract(contract.id, { notes: 'Updated notes' }, adminId);
      expect(updated.notes).toBe('Updated notes');
    });

    it('should update grace period', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      const updated = await contractService.editContract(contract.id, { gracePeriodDays: 5 }, adminId);
      expect(updated.gracePeriodDays).toBe(5);
    });

    it('should update ownership target and recalculate progress', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      const updated = await contractService.editContract(contract.id, { ownershipTargetDays: 100 }, adminId);
      expect(updated.ownershipTargetDays).toBe(100);
      // totalDaysPaid is 0, so progress is 0
      expect(updated.ownershipProgress).toBe(0);
    });

    it('should throw if contract not found', async () => {
      await expect(
        contractService.editContract('non-existent', { notes: 'test' }, adminId)
      ).rejects.toThrow('Contract not found');
    });
  });

  describe('cancelContract', () => {
    it('should cancel an active contract and auto-void pending invoices', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      const updated = await contractService.cancelContract(contract.id, { reason: 'Customer request' }, adminId);
      expect(updated.status).toBe(ContractStatus.CANCELLED);
      expect(updated.notes).toContain('[CANCELLED] Customer request');

      // Pending invoices should be voided
      const invoices = await invoiceRepo.findByContractId(contract.id);
      const pendingInvoices = invoices.filter(i => i.status === PaymentStatus.PENDING);
      expect(pendingInvoices.length).toBe(0);
    });

    it('should reject cancelling a completed contract', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await contractRepo.update(contract.id, { status: ContractStatus.COMPLETED });

      await expect(
        contractService.cancelContract(contract.id, { reason: 'test' }, adminId)
      ).rejects.toThrow('Cannot cancel a completed contract');
    });

    it('should reject cancelling an already cancelled contract', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await contractService.cancelContract(contract.id, { reason: 'first' }, adminId);

      await expect(
        contractService.cancelContract(contract.id, { reason: 'second' }, adminId)
      ).rejects.toThrow('Contract already cancelled');
    });

    it('should reject cancelling a repossessed contract', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: '',
      }, adminId);

      await contractService.repossess(contract.id, adminId);

      await expect(
        contractService.cancelContract(contract.id, { reason: 'test' }, adminId)
      ).rejects.toThrow('Cannot cancel a repossessed contract');
    });

    it('should append cancel reason to existing notes', async () => {
      const { contract } = await contractService.create({
        customerId,
        motorModel: MotorModel.ATHENA,
        durationDays: 3,
        startDate: '2026-03-01',
        notes: 'Existing note',
      }, adminId);

      const updated = await contractService.cancelContract(contract.id, { reason: 'No longer needed' }, adminId);
      expect(updated.notes).toContain('Existing note');
      expect(updated.notes).toContain('[CANCELLED] No longer needed');
    });
  });
});
