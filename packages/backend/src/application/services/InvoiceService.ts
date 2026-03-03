import {
  IInvoiceRepository,
  IContractRepository,
  IAuditLogRepository,
  PaginationParams,
  PaginatedResult,
} from '../../domain/interfaces';
import { Invoice, Contract } from '../../domain/entities';
import { PaymentStatus, AuditAction, ContractStatus } from '../../domain/enums';
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

  async getAllPaginated(params: PaginationParams): Promise<PaginatedResult<Invoice>> {
    return this.invoiceRepo.findAllPaginated(params);
  }

  async getById(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findById(id);
    if (!invoice) throw new Error('Invoice not found');
    return invoice;
  }

  async getByContractId(contractId: string): Promise<Invoice[]> {
    return this.invoiceRepo.findByContractId(contractId);
  }

  async getByCustomerId(customerId: string): Promise<Invoice[]> {
    return this.invoiceRepo.findByCustomerId(customerId);
  }

  async generateQRCode(invoiceId: string): Promise<string> {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const totalPayable = invoice.amount + (invoice.lateFee || 0);
    const qrData = JSON.stringify({
      invoiceNumber: invoice.invoiceNumber,
      amount: totalPayable,
      payTo: 'WEDISON Motor Listrik',
      reference: invoice.qrCodeData,
    });

    return QRCode.toDataURL(qrData);
  }

  /**
   * Apply paid invoice to contract: credit days, update progress, check completion
   */
  private async applyPaymentToContract(invoice: Invoice): Promise<void> {
    if (!invoice.extensionDays || invoice.extensionDays <= 0) return;

    const contract = await this.contractRepo.findById(invoice.contractId);
    if (!contract) return;

    const newTotalDaysPaid = contract.totalDaysPaid + invoice.extensionDays;
    const newProgress = parseFloat(((newTotalDaysPaid / contract.ownershipTargetDays) * 100).toFixed(2));
    const isCompleted = newTotalDaysPaid >= contract.ownershipTargetDays;

    const isInitialPayment = contract.totalDaysPaid === 0;

    const updateData: Partial<Contract> = {
      totalDaysPaid: newTotalDaysPaid,
      ownershipProgress: Math.min(newProgress, 100),
      status: isCompleted ? ContractStatus.COMPLETED : ContractStatus.ACTIVE,
      completedAt: isCompleted ? new Date() : contract.completedAt,
    };

    // For extension payments, also update durationDays, totalAmount, and endDate
    // For initial payments, these are already set correctly at contract creation
    if (!isInitialPayment) {
      const newStartDate = contract.endDate > new Date() ? contract.endDate : new Date();
      const newEndDate = new Date(newStartDate);
      newEndDate.setDate(newEndDate.getDate() + invoice.extensionDays);

      updateData.durationDays = contract.durationDays + invoice.extensionDays;
      updateData.totalAmount = contract.totalAmount + invoice.amount + (invoice.lateFee || 0);
      updateData.endDate = newEndDate;
    }

    await this.contractRepo.update(invoice.contractId, updateData);
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

    // If payment succeeded, apply extension to contract
    if (status === PaymentStatus.PAID) {
      await this.applyPaymentToContract(invoice);
    }

    const totalPayable = invoice.amount + (invoice.lateFee || 0);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.PAYMENT,
      module: 'invoice',
      entityId: invoiceId,
      description: `Payment ${status.toLowerCase()} for invoice ${invoice.invoiceNumber} - Rp ${totalPayable.toLocaleString('id-ID')}`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        lateFee: invoice.lateFee,
        paymentStatus: status,
        extensionDays: invoice.extensionDays,
      },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  async voidInvoice(invoiceId: string, adminId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (invoice.status === PaymentStatus.PAID) {
      throw new Error('Cannot void a paid invoice');
    }
    if (invoice.status === PaymentStatus.VOID) {
      throw new Error('Invoice already voided');
    }

    const updated = await this.invoiceRepo.update(invoiceId, { status: PaymentStatus.VOID });
    if (!updated) throw new Error('Failed to update invoice');

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'invoice',
      entityId: invoiceId,
      description: `Voided invoice ${invoice.invoiceNumber} - Rp ${invoice.amount.toLocaleString('id-ID')}`,
      metadata: { invoiceNumber: invoice.invoiceNumber, amount: invoice.amount, previousStatus: invoice.status },
      ipAddress: '',
      createdAt: new Date(),
    });

    return updated;
  }

  async markPaid(invoiceId: string, adminId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (invoice.status === PaymentStatus.PAID) {
      throw new Error('Invoice already paid');
    }
    if (invoice.status === PaymentStatus.VOID) {
      throw new Error('Cannot pay a voided invoice');
    }

    const updateData: Partial<Invoice> = {
      status: PaymentStatus.PAID,
      paidAt: new Date(),
    };

    const updated = await this.invoiceRepo.update(invoiceId, updateData);
    if (!updated) throw new Error('Failed to update invoice');

    // Apply extension if applicable
    await this.applyPaymentToContract(invoice);

    const totalPayable = invoice.amount + (invoice.lateFee || 0);

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.PAYMENT,
      module: 'invoice',
      entityId: invoiceId,
      description: `Manual payment for invoice ${invoice.invoiceNumber} - Rp ${totalPayable.toLocaleString('id-ID')}`,
      metadata: { invoiceNumber: invoice.invoiceNumber, amount: invoice.amount, lateFee: invoice.lateFee, manual: true, extensionDays: invoice.extensionDays },
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

  async bulkMarkPaid(invoiceIds: string[], adminId: string): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of invoiceIds) {
      try {
        await this.markPaid(id, adminId);
        success.push(id);
      } catch (error: any) {
        failed.push({ id, error: error.message });
      }
    }

    return { success, failed };
  }
}
