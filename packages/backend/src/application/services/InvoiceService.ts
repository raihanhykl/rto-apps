import {
  IInvoiceRepository,
  IContractRepository,
  IAuditLogRepository,
} from '../../domain/interfaces';
import { Invoice } from '../../domain/entities';
import { PaymentStatus, ContractStatus, AuditAction } from '../../domain/enums';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

export class InvoiceService {
  constructor(
    private invoiceRepo: IInvoiceRepository,
    private contractRepo: IContractRepository,
    private auditRepo: IAuditLogRepository
  ) {}

  async getAll(): Promise<Invoice[]> {
    return this.invoiceRepo.findAll();
  }

  async getById(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findById(id);
    if (!invoice) throw new Error('Invoice not found');
    return invoice;
  }

  async getByContractId(contractId: string): Promise<Invoice | null> {
    return this.invoiceRepo.findByContractId(contractId);
  }

  async getByCustomerId(customerId: string): Promise<Invoice[]> {
    return this.invoiceRepo.findByCustomerId(customerId);
  }

  async generateQRCode(invoiceId: string): Promise<string> {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const qrData = JSON.stringify({
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      payTo: 'WEDISON Motor Listrik',
      reference: invoice.qrCodeData,
    });

    return QRCode.toDataURL(qrData);
  }

  async simulatePayment(
    invoiceId: string,
    status: PaymentStatus.PAID | PaymentStatus.FAILED,
    adminId: string
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (invoice.status === PaymentStatus.PAID) {
      throw new Error('Invoice already paid');
    }

    const updateData: Partial<Invoice> = {
      status,
      paidAt: status === PaymentStatus.PAID ? new Date() : null,
    };

    const updated = await this.invoiceRepo.update(invoiceId, updateData);
    if (!updated) throw new Error('Failed to update invoice');

    // Update contract status if payment succeeds
    if (status === PaymentStatus.PAID) {
      await this.contractRepo.update(invoice.contractId, {
        status: ContractStatus.COMPLETED,
      });
    }

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.PAYMENT,
      module: 'invoice',
      entityId: invoiceId,
      description: `Payment ${status.toLowerCase()} for invoice ${invoice.invoiceNumber} - Rp ${invoice.amount.toLocaleString('id-ID')}`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        paymentStatus: status,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

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
}
