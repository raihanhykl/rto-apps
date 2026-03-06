import { ContractService } from '../application/services/ContractService';
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryCustomerRepository } from '../infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '../infrastructure/repositories/InMemoryInvoiceRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import { MotorModel, BatteryType, DPScheme, ContractStatus, PaymentStatus, InvoiceType, DEFAULT_OWNERSHIP_TARGET_DAYS, DEFAULT_GRACE_PERIOD_DAYS, MOTOR_DAILY_RATES, DP_AMOUNTS } from '../domain/enums';
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
      birthDate: null,
      gender: null,
      rideHailingApps: [],
      ktpNumber: '3201011234567890',
      ktpPhoto: null,
      simPhoto: null,
      kkPhoto: null,
      guarantorName: '',
      guarantorPhone: '',
      guarantorKtpPhoto: null,
      spouseName: '',
      spouseKtpPhoto: null,
      notes: '',
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // Default create DTO for convenience
  const defaultCreateDto = (overrides = {}) => ({
    customerId: '', // will be set in tests
    motorModel: MotorModel.ATHENA,
    batteryType: BatteryType.REGULAR,
    dpScheme: DPScheme.FULL,
    startDate: '2026-03-01',
    color: '',
    year: null as number | null,
    vinNumber: '',
    engineNumber: '',
    notes: '',
    ...overrides,
  });

  // Helper: pay DP invoice(s) so receiveUnit/extend is not blocked
  async function payDpInvoices(contractId: string) {
    const invoices = await invoiceRepo.findByContractId(contractId);
    for (const inv of invoices) {
      if ((inv.type === InvoiceType.DP || inv.type === InvoiceType.DP_INSTALLMENT) && inv.status === PaymentStatus.PENDING) {
        await invoiceRepo.update(inv.id, { status: PaymentStatus.PAID, paidAt: new Date() });
      }
    }
  }

  // Helper: pay all pending invoices
  async function payAllPendingInvoices(contractId: string) {
    const invoices = await invoiceRepo.findByContractId(contractId);
    for (const inv of invoices) {
      if (inv.status === PaymentStatus.PENDING) {
        await invoiceRepo.update(inv.id, { status: PaymentStatus.PAID, paidAt: new Date() });
      }
    }
  }

  describe('create', () => {
    it('should create contract with DP FULL scheme and generate 1 DP invoice', async () => {
      const result = await contractService.create(defaultCreateDto({ customerId }), adminId);

      const rateKey = 'ATHENA_REGULAR';
      expect(result.contract.dailyRate).toBe(MOTOR_DAILY_RATES[rateKey]);
      expect(result.contract.dpAmount).toBe(DP_AMOUNTS[rateKey]);
      expect(result.contract.dpScheme).toBe(DPScheme.FULL);
      expect(result.contract.batteryType).toBe(BatteryType.REGULAR);
      expect(result.contract.status).toBe(ContractStatus.ACTIVE);
      expect(result.contract.durationDays).toBe(0);
      expect(result.contract.totalAmount).toBe(0);
      expect(result.contract.unitReceivedDate).toBeNull();
      expect(result.contract.billingStartDate).toBeNull();

      // Should generate exactly 1 DP invoice
      expect(result.invoices.length).toBe(1);
      expect(result.invoices[0].type).toBe(InvoiceType.DP);
      expect(result.invoices[0].amount).toBe(DP_AMOUNTS[rateKey]);
      expect(result.invoices[0].status).toBe(PaymentStatus.PENDING);
      expect(result.invoices[0].extensionDays).toBeNull();
    });

    it('should create contract with DP INSTALLMENT scheme and generate 2 invoices', async () => {
      const result = await contractService.create(
        defaultCreateDto({ customerId, dpScheme: DPScheme.INSTALLMENT }),
        adminId
      );

      const dpAmount = DP_AMOUNTS['ATHENA_REGULAR'];
      expect(result.invoices.length).toBe(2);
      expect(result.invoices[0].type).toBe(InvoiceType.DP_INSTALLMENT);
      expect(result.invoices[1].type).toBe(InvoiceType.DP_INSTALLMENT);
      expect(result.invoices[0].amount).toBe(Math.ceil(dpAmount / 2));
      expect(result.invoices[1].amount).toBe(Math.floor(dpAmount / 2));
      // Total of both installments = dpAmount
      expect(result.invoices[0].amount + result.invoices[1].amount).toBe(dpAmount);
    });

    it('should create contract with EdPower Extended battery type', async () => {
      const result = await contractService.create(
        defaultCreateDto({ customerId, motorModel: MotorModel.EDPOWER, batteryType: BatteryType.EXTENDED }),
        adminId
      );

      const rateKey = 'EDPOWER_EXTENDED';
      expect(result.contract.dailyRate).toBe(MOTOR_DAILY_RATES[rateKey]);
      expect(result.contract.dpAmount).toBe(DP_AMOUNTS[rateKey]);
      expect(result.contract.batteryType).toBe(BatteryType.EXTENDED);
    });

    it('should reject if customer not found', async () => {
      await expect(
        contractService.create(defaultCreateDto({ customerId: 'non-existent' }), adminId)
      ).rejects.toThrow('Customer not found');
    });

    it('should generate contract number with WNUS-KTR format', async () => {
      const result = await contractService.create(defaultCreateDto({ customerId }), adminId);
      expect(result.contract.contractNumber).toMatch(/^\d+\/WNUS-KTR\/[IVX]+\/\d{4}$/);
    });

    it('should create audit log', async () => {
      await contractService.create(defaultCreateDto({ customerId }), adminId);
      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('CREATE');
      expect(logs[0].module).toBe('contract');
    });

    it('should initialize RTO fields correctly', async () => {
      const result = await contractService.create(defaultCreateDto({ customerId }), adminId);

      expect(result.contract.ownershipTargetDays).toBe(DEFAULT_OWNERSHIP_TARGET_DAYS);
      expect(result.contract.totalDaysPaid).toBe(0);
      expect(result.contract.ownershipProgress).toBe(0);
      expect(result.contract.gracePeriodDays).toBe(DEFAULT_GRACE_PERIOD_DAYS);
      expect(result.contract.repossessedAt).toBeNull();
      expect(result.contract.completedAt).toBeNull();
      expect(result.contract.dpFullyPaid).toBe(false);
      expect(result.contract.dpPaidAmount).toBe(0);
    });
  });

  describe('receiveUnit', () => {
    const bastPhoto = 'https://storage.example.com/bast/test.jpg';

    it('should set unitReceivedDate and billingStartDate when DP is paid (FULL)', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await payDpInvoices(contract.id);

      const updated = await contractService.receiveUnit(contract.id, adminId, bastPhoto, 'Test notes');
      expect(updated.unitReceivedDate).not.toBeNull();
      expect(updated.billingStartDate).not.toBeNull();
      expect(updated.bastPhoto).toBe(bastPhoto);
      expect(updated.bastNotes).toBe('Test notes');
    });

    it('should allow receive unit when 1st DP installment is paid (INSTALLMENT)', async () => {
      const { contract, invoices } = await contractService.create(
        defaultCreateDto({ customerId, dpScheme: DPScheme.INSTALLMENT }),
        adminId
      );

      // Pay only the first installment
      await invoiceRepo.update(invoices[0].id, { status: PaymentStatus.PAID, paidAt: new Date() });

      const updated = await contractService.receiveUnit(contract.id, adminId, bastPhoto);
      expect(updated.unitReceivedDate).not.toBeNull();
      expect(updated.billingStartDate).not.toBeNull();
    });

    it('should reject if BAST photo is not provided', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await payDpInvoices(contract.id);

      await expect(
        contractService.receiveUnit(contract.id, adminId, '')
      ).rejects.toThrow('Foto BAST wajib dilampirkan saat serah terima unit');
    });

    it('should reject if DP is not paid (FULL)', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);

      await expect(
        contractService.receiveUnit(contract.id, adminId, bastPhoto)
      ).rejects.toThrow('DP harus dibayar lunas sebelum unit bisa diterima');
    });

    it('should reject if 1st installment is not paid (INSTALLMENT)', async () => {
      const { contract } = await contractService.create(
        defaultCreateDto({ customerId, dpScheme: DPScheme.INSTALLMENT }),
        adminId
      );

      await expect(
        contractService.receiveUnit(contract.id, adminId, bastPhoto)
      ).rejects.toThrow('DP cicilan pertama harus dibayar sebelum unit bisa diterima');
    });

    it('should reject if unit already received', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await payDpInvoices(contract.id);
      await contractService.receiveUnit(contract.id, adminId, bastPhoto);

      await expect(
        contractService.receiveUnit(contract.id, adminId, bastPhoto)
      ).rejects.toThrow('Unit already received for this contract');
    });

    it('should reject if contract is not ACTIVE', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await contractRepo.update(contract.id, { status: ContractStatus.COMPLETED });

      await expect(
        contractService.receiveUnit(contract.id, adminId, bastPhoto)
      ).rejects.toThrow('Only ACTIVE contracts can receive unit');
    });

    it('should create audit log', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await payDpInvoices(contract.id);
      await contractService.receiveUnit(contract.id, adminId, bastPhoto);

      const logs = await auditRepo.findAll();
      const receiveLog = logs.find(l => l.description.includes('Unit received'));
      expect(receiveLog).toBeDefined();
    });
  });

  describe('extend', () => {
    it('should create extension invoice without updating contract', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      // Pay DP and all pending invoices so extend is not blocked
      await payAllPendingInvoices(contract.id);

      const result = await contractService.extend(contract.id, { durationDays: 5 }, adminId);

      expect(result.contract.durationDays).toBe(0); // unchanged
      expect(result.contract.totalAmount).toBe(0); // unchanged
      const athenaRate = MOTOR_DAILY_RATES['ATHENA_REGULAR'];
      expect(result.invoice.amount).toBe(athenaRate * 5);
      expect(result.invoice.extensionDays).toBe(5);
      expect(result.invoice.status).toBe(PaymentStatus.PENDING);
    });

    it('should generate new invoice for extension', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await payAllPendingInvoices(contract.id);
      await contractService.extend(contract.id, { durationDays: 7 }, adminId);

      const invoices = await invoiceRepo.findByContractId(contract.id);
      expect(invoices.length).toBe(2); // DP + extension
    });

    it('should reject extending a completed contract', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await contractRepo.update(contract.id, { status: ContractStatus.COMPLETED });

      await expect(
        contractService.extend(contract.id, { durationDays: 3 }, adminId)
      ).rejects.toThrow('Only ACTIVE or OVERDUE contracts can be extended');
    });

    it('should reject extending beyond max rental days', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await payAllPendingInvoices(contract.id);

      await expect(
        contractService.extend(contract.id, { durationDays: 8 }, adminId)
      ).rejects.toThrow('Maximum extension is 7 days');
    });

    it('should allow extending overdue contracts', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await payAllPendingInvoices(contract.id);
      await contractRepo.update(contract.id, { status: ContractStatus.OVERDUE });

      const result = await contractService.extend(contract.id, { durationDays: 5 }, adminId);
      expect(result.contract.status).toBe(ContractStatus.OVERDUE);
      expect(result.invoice.extensionDays).toBe(5);
    });

    it('should reject extension when pending invoice exists', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);

      // DP invoice is still PENDING, so extension should be blocked
      await expect(
        contractService.extend(contract.id, { durationDays: 5 }, adminId)
      ).rejects.toThrow('masih ada invoice yang belum dibayar');
    });
  });

  describe('repossess', () => {
    it('should repossess an active contract', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);

      const result = await contractService.repossess(contract.id, adminId);
      expect(result.status).toBe(ContractStatus.REPOSSESSED);
      expect(result.repossessedAt).not.toBeNull();
    });

    it('should auto-void pending invoices on repossess', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);

      await contractService.repossess(contract.id, adminId);

      const invoices = await invoiceRepo.findByContractId(contract.id);
      const pendingInvoices = invoices.filter(i => i.status === PaymentStatus.PENDING);
      expect(pendingInvoices.length).toBe(0);
      const voidedInvoices = invoices.filter(i => i.status === PaymentStatus.VOID);
      expect(voidedInvoices.length).toBe(1); // DP invoice voided
    });

    it('should reject repossessing a completed contract', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await contractRepo.update(contract.id, { status: ContractStatus.COMPLETED });

      await expect(
        contractService.repossess(contract.id, adminId)
      ).rejects.toThrow('Cannot repossess a completed contract');
    });

    it('should reject repossessing an already repossessed contract', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await contractService.repossess(contract.id, adminId);

      await expect(
        contractService.repossess(contract.id, adminId)
      ).rejects.toThrow('Contract already repossessed');
    });

    it('should create audit log for repossession', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await contractService.repossess(contract.id, adminId);

      const logs = await auditRepo.findAll();
      const repossessLog = logs.find(l => l.description.includes('Repossessed'));
      expect(repossessLog).toBeDefined();
    });
  });

  describe('updateStatus', () => {
    it('should update contract status with valid transition', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);

      const updated = await contractService.updateStatus(
        contract.id,
        { status: ContractStatus.COMPLETED },
        adminId
      );

      expect(updated.status).toBe(ContractStatus.COMPLETED);
    });

    it('should reject invalid status transition', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
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
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);

      const detail = await contractService.getDetailById(contract.id);
      expect(detail.contract.id).toBe(contract.id);
      expect(detail.customer.id).toBe(customerId);
      expect(detail.invoices.length).toBe(1); // DP invoice
    });

    it('should return multiple invoices after extension', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await payAllPendingInvoices(contract.id);
      await contractService.extend(contract.id, { durationDays: 5 }, adminId);

      const detail = await contractService.getDetailById(contract.id);
      expect(detail.invoices.length).toBe(2); // DP + extension
    });

    it('should throw if contract not found', async () => {
      await expect(contractService.getDetailById('non-existent')).rejects.toThrow('Contract not found');
    });
  });

  describe('getByCustomerId', () => {
    it('should return contracts for a customer', async () => {
      await contractService.create(defaultCreateDto({ customerId }), adminId);
      await contractService.create(
        defaultCreateDto({ customerId, motorModel: MotorModel.VICTORY }),
        adminId
      );

      const contracts = await contractService.getByCustomerId(customerId);
      expect(contracts.length).toBe(2);
    });
  });

  describe('editContract', () => {
    it('should update notes', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);

      const updated = await contractService.editContract(contract.id, { notes: 'Updated notes' }, adminId);
      expect(updated.notes).toBe('Updated notes');
    });

    it('should update grace period', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);

      const updated = await contractService.editContract(contract.id, { gracePeriodDays: 5 }, adminId);
      expect(updated.gracePeriodDays).toBe(5);
    });

    it('should update ownership target and recalculate progress', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);

      const updated = await contractService.editContract(contract.id, { ownershipTargetDays: 100 }, adminId);
      expect(updated.ownershipTargetDays).toBe(100);
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
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);

      const updated = await contractService.cancelContract(contract.id, { reason: 'Customer request' }, adminId);
      expect(updated.status).toBe(ContractStatus.CANCELLED);
      expect(updated.notes).toContain('[CANCELLED] Customer request');

      const invoices = await invoiceRepo.findByContractId(contract.id);
      const pendingInvoices = invoices.filter(i => i.status === PaymentStatus.PENDING);
      expect(pendingInvoices.length).toBe(0);
    });

    it('should reject cancelling a completed contract', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await contractRepo.update(contract.id, { status: ContractStatus.COMPLETED });

      await expect(
        contractService.cancelContract(contract.id, { reason: 'test' }, adminId)
      ).rejects.toThrow('Cannot cancel a completed contract');
    });

    it('should reject cancelling an already cancelled contract', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await contractService.cancelContract(contract.id, { reason: 'first' }, adminId);

      await expect(
        contractService.cancelContract(contract.id, { reason: 'second' }, adminId)
      ).rejects.toThrow('Contract already cancelled');
    });

    it('should reject cancelling a repossessed contract', async () => {
      const { contract } = await contractService.create(defaultCreateDto({ customerId }), adminId);
      await contractService.repossess(contract.id, adminId);

      await expect(
        contractService.cancelContract(contract.id, { reason: 'test' }, adminId)
      ).rejects.toThrow('Cannot cancel a repossessed contract');
    });

    it('should append cancel reason to existing notes', async () => {
      const { contract } = await contractService.create(
        defaultCreateDto({ customerId, notes: 'Existing note' }),
        adminId
      );

      const updated = await contractService.cancelContract(contract.id, { reason: 'No longer needed' }, adminId);
      expect(updated.notes).toContain('Existing note');
      expect(updated.notes).toContain('[CANCELLED] No longer needed');
    });
  });
});
