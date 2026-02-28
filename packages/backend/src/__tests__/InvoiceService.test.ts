import { InvoiceService } from '../application/services/InvoiceService';
import { InMemoryInvoiceRepository } from '../infrastructure/repositories/InMemoryInvoiceRepository';
import { InMemoryContractRepository } from '../infrastructure/repositories/InMemoryContractRepository';
import { InMemoryAuditLogRepository } from '../infrastructure/repositories/InMemoryAuditLogRepository';
import { PaymentStatus, ContractStatus, MotorModel } from '../domain/enums';
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

    // Seed a contract
    const contractId = uuidv4();
    const customerId = uuidv4();
    sampleContract = await contractRepo.create({
      id: contractId,
      contractNumber: 'RTO-260301-0001',
      customerId,
      motorModel: MotorModel.ATHENA,
      dailyRate: 55000,
      durationDays: 3,
      totalAmount: 165000,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-04'),
      status: ContractStatus.ACTIVE,
      notes: '',
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed an invoice
    const invoiceId = uuidv4();
    sampleInvoice = await invoiceRepo.create({
      id: invoiceId,
      invoiceNumber: 'INV-260301-0001',
      contractId,
      customerId,
      amount: 165000,
      status: PaymentStatus.PENDING,
      qrCodeData: 'WEDISON-PAY-INV-260301-0001-165000',
      dueDate: new Date('2026-03-02'),
      paidAt: null,
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

    it('should update contract status to COMPLETED when paid', async () => {
      await invoiceService.simulatePayment(sampleInvoice.id, PaymentStatus.PAID, adminId);

      const contract = await contractRepo.findById(sampleContract.id);
      expect(contract!.status).toBe(ContractStatus.COMPLETED);
    });

    it('should mark invoice as FAILED without completing contract', async () => {
      const updated = await invoiceService.simulatePayment(
        sampleInvoice.id,
        PaymentStatus.FAILED,
        adminId
      );

      expect(updated.status).toBe(PaymentStatus.FAILED);
      expect(updated.paidAt).toBeNull();

      const contract = await contractRepo.findById(sampleContract.id);
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
});
