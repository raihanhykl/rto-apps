import { InvoiceService } from '../application/services/InvoiceService';
import { InMemoryInvoiceRepository } from '../infrastructure/repositories/InMemoryInvoiceRepository';
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import { PaymentStatus, ContractStatus, MotorModel, BatteryType, DPScheme, InvoiceType, DEFAULT_OWNERSHIP_TARGET_DAYS, DEFAULT_GRACE_PERIOD_DAYS, DEFAULT_HOLIDAY_DAYS_PER_MONTH } from '../domain/enums';
import { v4 as uuidv4 } from 'uuid';
import { Invoice, Contract } from '../domain/entities';

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;
  let invoiceRepo: InMemoryInvoiceRepository;
  let contractRepo: InMemoryContractRepository;
  let auditRepo: InMemoryAuditLogRepository;
  const adminId = 'admin-1';

  let sampleContract: Contract;
  let sampleInvoice: Invoice;

  beforeEach(async () => {
    invoiceRepo = new InMemoryInvoiceRepository();
    contractRepo = new InMemoryContractRepository();
    auditRepo = new InMemoryAuditLogRepository();
    invoiceService = new InvoiceService(invoiceRepo, contractRepo, auditRepo);

    // Seed a contract with RTO fields (totalDaysPaid=0, matching new creation logic)
    const contractId = uuidv4();
    const customerId = uuidv4();
    sampleContract = await contractRepo.create({
      id: contractId,
      contractNumber: 'RTO-260301-0001',
      customerId,
      motorModel: MotorModel.ATHENA,
      batteryType: BatteryType.REGULAR,
      dailyRate: 55000,
      durationDays: 3,
      totalAmount: 165000,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-04'),
      status: ContractStatus.ACTIVE,
      notes: '',
      createdBy: adminId,
      color: '',
      year: null,
      vinNumber: '',
      engineNumber: '',
      dpAmount: 0,
      dpScheme: DPScheme.FULL,
      dpPaidAmount: 0,
      dpFullyPaid: false,
      unitReceivedDate: null,
      billingStartDate: null,
      bastPhoto: null,
      bastNotes: '',
      holidayDaysPerMonth: DEFAULT_HOLIDAY_DAYS_PER_MONTH,
      ownershipTargetDays: DEFAULT_OWNERSHIP_TARGET_DAYS,
      totalDaysPaid: 0,
      ownershipProgress: 0,
      gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
      repossessedAt: null,
      completedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed initial invoice with extensionDays (matching new creation logic)
    const invoiceId = uuidv4();
    sampleInvoice = await invoiceRepo.create({
      id: invoiceId,
      invoiceNumber: 'INV-260301-0001',
      contractId,
      customerId,
      amount: 165000,
      lateFee: 0,
      type: InvoiceType.MANUAL_PAYMENT,
      status: PaymentStatus.PENDING,
      qrCodeData: 'WEDISON-PAY-INV-260301-0001-165000',
      dueDate: new Date('2026-03-02'),
      paidAt: null,
      extensionDays: 3,
      dokuPaymentUrl: null,
      dokuReferenceId: null,
      billingPeriodStart: null,
      billingPeriodEnd: null,
      billingId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('getAll', () => {
    it('should return all invoices', async () => {
      const all = await invoiceService.getAll();
      expect(all.length).toBe(1);
    });
  });

  describe('getById', () => {
    it('should return invoice by id', async () => {
      const invoice = await invoiceService.getById(sampleInvoice.id);
      expect(invoice.invoiceNumber).toBe('INV-260301-0001');
    });

    it('should throw if invoice not found', async () => {
      await expect(invoiceService.getById('non-existent')).rejects.toThrow('Invoice not found');
    });
  });

  describe('getByContractId', () => {
    it('should return invoices array for contract', async () => {
      const invoices = await invoiceService.getByContractId(sampleContract.id);
      expect(Array.isArray(invoices)).toBe(true);
      expect(invoices.length).toBe(1);
    });
  });

  describe('simulatePayment', () => {
    it('should mark invoice as PAID', async () => {
      const updated = await invoiceService.simulatePayment(
        sampleInvoice.id,
        PaymentStatus.PAID,
        adminId
      );

      expect(updated.status).toBe(PaymentStatus.PAID);
      expect(updated.paidAt).not.toBeNull();
    });

    it('should credit days to contract when initial invoice is paid', async () => {
      await invoiceService.simulatePayment(sampleInvoice.id, PaymentStatus.PAID, adminId);

      const contract = await contractRepo.findById(sampleContract.id);
      // Initial payment credits totalDaysPaid but doesn't change durationDays/totalAmount/endDate
      expect(contract!.totalDaysPaid).toBe(3);
      expect(contract!.durationDays).toBe(3); // unchanged
      expect(contract!.totalAmount).toBe(165000); // unchanged
      expect(contract!.status).toBe(ContractStatus.ACTIVE);
    });

    it('should mark invoice as FAILED without affecting contract', async () => {
      const updated = await invoiceService.simulatePayment(
        sampleInvoice.id,
        PaymentStatus.FAILED,
        adminId
      );

      expect(updated.status).toBe(PaymentStatus.FAILED);
      expect(updated.paidAt).toBeNull();

      const contract = await contractRepo.findById(sampleContract.id);
      expect(contract!.totalDaysPaid).toBe(0); // unchanged
      expect(contract!.status).toBe(ContractStatus.ACTIVE);
    });

    it('should throw if invoice already paid', async () => {
      await invoiceService.simulatePayment(sampleInvoice.id, PaymentStatus.PAID, adminId);

      await expect(
        invoiceService.simulatePayment(sampleInvoice.id, PaymentStatus.PAID, adminId)
      ).rejects.toThrow('Invoice already paid');
    });

    it('should throw if invoice not found', async () => {
      await expect(
        invoiceService.simulatePayment('non-existent', PaymentStatus.PAID, adminId)
      ).rejects.toThrow('Invoice not found');
    });

    it('should create audit log on payment', async () => {
      await invoiceService.simulatePayment(sampleInvoice.id, PaymentStatus.PAID, adminId);

      const logs = await auditRepo.findAll();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('PAYMENT');
      expect(logs[0].module).toBe('invoice');
    });

    it('should apply extension to contract when extension invoice is paid', async () => {
      // First pay the initial invoice
      await invoiceService.simulatePayment(sampleInvoice.id, PaymentStatus.PAID, adminId);

      // Create an extension invoice
      const extInvoiceId = uuidv4();
      await invoiceRepo.create({
        id: extInvoiceId,
        invoiceNumber: 'INV-260301-0002',
        contractId: sampleContract.id,
        customerId: sampleContract.customerId,
        amount: 55000 * 5,
        lateFee: 0,
        type: InvoiceType.MANUAL_PAYMENT,
        status: PaymentStatus.PENDING,
        qrCodeData: 'WEDISON-PAY-INV-260301-0002-275000',
        dueDate: new Date('2026-03-05'),
        paidAt: null,
        extensionDays: 5,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        billingPeriodStart: null,
        billingPeriodEnd: null,
        billingId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await invoiceService.simulatePayment(extInvoiceId, PaymentStatus.PAID, adminId);

      const contract = await contractRepo.findById(sampleContract.id);
      expect(contract!.totalDaysPaid).toBe(8); // 3 + 5
      expect(contract!.durationDays).toBe(8); // 3 + 5
      expect(contract!.totalAmount).toBe(165000 + 275000);
    });

    it('should NOT apply extension to contract when extension invoice fails', async () => {
      // Pay initial invoice first
      await invoiceService.simulatePayment(sampleInvoice.id, PaymentStatus.PAID, adminId);

      const extInvoiceId = uuidv4();
      await invoiceRepo.create({
        id: extInvoiceId,
        invoiceNumber: 'INV-260301-0003',
        contractId: sampleContract.id,
        customerId: sampleContract.customerId,
        amount: 55000 * 5,
        lateFee: 0,
        type: InvoiceType.MANUAL_PAYMENT,
        status: PaymentStatus.PENDING,
        qrCodeData: 'WEDISON-PAY-INV-260301-0003-275000',
        dueDate: new Date('2026-03-05'),
        paidAt: null,
        extensionDays: 5,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        billingPeriodStart: null,
        billingPeriodEnd: null,
        billingId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await invoiceService.simulatePayment(extInvoiceId, PaymentStatus.FAILED, adminId);

      const contract = await contractRepo.findById(sampleContract.id);
      expect(contract!.totalDaysPaid).toBe(3); // only initial payment
      expect(contract!.durationDays).toBe(3); // unchanged
    });
  });

  describe('totalRevenue', () => {
    it('should return sum of paid invoices', async () => {
      await invoiceService.simulatePayment(sampleInvoice.id, PaymentStatus.PAID, adminId);
      const revenue = await invoiceService.totalRevenue();
      expect(revenue).toBe(165000);
    });

    it('should return 0 when no paid invoices', async () => {
      const revenue = await invoiceService.totalRevenue();
      expect(revenue).toBe(0);
    });
  });

  describe('totalPending', () => {
    it('should return sum of pending invoices', async () => {
      const pending = await invoiceService.totalPending();
      expect(pending).toBe(165000);
    });
  });

  describe('generateQRCode', () => {
    it('should return QR code data URL', async () => {
      const qr = await invoiceService.generateQRCode(sampleInvoice.id);
      expect(qr).toMatch(/^data:image\/png;base64,/);
    });

    it('should throw if invoice not found', async () => {
      await expect(invoiceService.generateQRCode('non-existent')).rejects.toThrow('Invoice not found');
    });
  });

  describe('voidInvoice', () => {
    it('should void a pending invoice', async () => {
      const updated = await invoiceService.voidInvoice(sampleInvoice.id, adminId);
      expect(updated.status).toBe(PaymentStatus.VOID);
    });

    it('should throw if invoice already paid', async () => {
      await invoiceService.simulatePayment(sampleInvoice.id, PaymentStatus.PAID, adminId);
      await expect(
        invoiceService.voidInvoice(sampleInvoice.id, adminId)
      ).rejects.toThrow('Cannot void a paid invoice');
    });

    it('should throw if invoice already voided', async () => {
      await invoiceService.voidInvoice(sampleInvoice.id, adminId);
      await expect(
        invoiceService.voidInvoice(sampleInvoice.id, adminId)
      ).rejects.toThrow('Invoice already voided');
    });

    it('should throw if invoice not found', async () => {
      await expect(
        invoiceService.voidInvoice('non-existent', adminId)
      ).rejects.toThrow('Invoice not found');
    });

    it('should create audit log', async () => {
      await invoiceService.voidInvoice(sampleInvoice.id, adminId);
      const logs = await auditRepo.findAll();
      const voidLog = logs.find(l => l.description.includes('Voided'));
      expect(voidLog).toBeDefined();
    });
  });

  describe('markPaid', () => {
    it('should mark a pending invoice as paid', async () => {
      const updated = await invoiceService.markPaid(sampleInvoice.id, adminId);
      expect(updated.status).toBe(PaymentStatus.PAID);
      expect(updated.paidAt).not.toBeNull();
    });

    it('should apply extension when marking extension invoice as paid', async () => {
      // Pay initial invoice first
      await invoiceService.simulatePayment(sampleInvoice.id, PaymentStatus.PAID, adminId);

      const extInvoiceId = uuidv4();
      await invoiceRepo.create({
        id: extInvoiceId,
        invoiceNumber: 'INV-260301-0010',
        contractId: sampleContract.id,
        customerId: sampleContract.customerId,
        amount: 55000 * 3,
        lateFee: 0,
        type: InvoiceType.MANUAL_PAYMENT,
        status: PaymentStatus.PENDING,
        qrCodeData: 'WEDISON-PAY-INV-260301-0010',
        dueDate: new Date('2026-03-05'),
        paidAt: null,
        extensionDays: 3,
        dokuPaymentUrl: null,
        dokuReferenceId: null,
        billingPeriodStart: null,
        billingPeriodEnd: null,
        billingId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await invoiceService.markPaid(extInvoiceId, adminId);

      const contract = await contractRepo.findById(sampleContract.id);
      expect(contract!.totalDaysPaid).toBe(6); // 3 + 3
      expect(contract!.durationDays).toBe(6);
    });

    it('should throw if invoice already paid', async () => {
      await invoiceService.markPaid(sampleInvoice.id, adminId);
      await expect(
        invoiceService.markPaid(sampleInvoice.id, adminId)
      ).rejects.toThrow('Invoice already paid');
    });

    it('should throw if invoice is voided', async () => {
      await invoiceService.voidInvoice(sampleInvoice.id, adminId);
      await expect(
        invoiceService.markPaid(sampleInvoice.id, adminId)
      ).rejects.toThrow('Cannot pay a voided invoice');
    });

    it('should create audit log with manual flag', async () => {
      await invoiceService.markPaid(sampleInvoice.id, adminId);
      const logs = await auditRepo.findAll();
      const payLog = logs.find(l => l.description.includes('Manual payment'));
      expect(payLog).toBeDefined();
    });
  });
});
