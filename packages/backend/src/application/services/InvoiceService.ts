import {
  IInvoiceRepository,
  IContractRepository,
  IAuditLogRepository,
  PaginationParams,
  PaginatedResult,
} from '../../domain/interfaces';
import { Invoice, Contract } from '../../domain/entities';
import { PaymentStatus, AuditAction, ContractStatus, InvoiceType } from '../../domain/enums';
import { getWibToday } from '../../domain/utils/dateUtils';
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
    const contract = await this.contractRepo.findById(invoice.contractId);
    if (!contract) return;

    // Handle DP / DP_INSTALLMENT payments: update dpPaidAmount and dpFullyPaid
    if (invoice.type === InvoiceType.DP || invoice.type === InvoiceType.DP_INSTALLMENT) {
      const newDpPaid = contract.dpPaidAmount + invoice.amount;
      const dpFullyPaid = newDpPaid >= contract.dpAmount;
      await this.contractRepo.update(invoice.contractId, {
        dpPaidAmount: newDpPaid,
        dpFullyPaid,
      });
      return;
    }

    // For non-DP invoices, credit days to contract
    if (!invoice.extensionDays || invoice.extensionDays <= 0) return;

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
      const today = getWibToday();
      const newStartDate = contract.endDate > today ? contract.endDate : today;
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

  /**
   * Revert paid invoice: undo contract changes (DP or extension days)
   */
  private async revertPaymentFromContract(invoice: Invoice): Promise<void> {
    const contract = await this.contractRepo.findById(invoice.contractId);
    if (!contract) return;

    // Revert DP payments
    if (invoice.type === InvoiceType.DP || invoice.type === InvoiceType.DP_INSTALLMENT) {
      const newDpPaid = Math.max(0, contract.dpPaidAmount - invoice.amount);
      await this.contractRepo.update(invoice.contractId, {
        dpPaidAmount: newDpPaid,
        dpFullyPaid: newDpPaid >= contract.dpAmount,
      });
      return;
    }

    // Revert extension days
    if (!invoice.extensionDays || invoice.extensionDays <= 0) return;

    const newTotalDaysPaid = Math.max(0, contract.totalDaysPaid - invoice.extensionDays);
    const newProgress = contract.ownershipTargetDays > 0
      ? parseFloat(((newTotalDaysPaid / contract.ownershipTargetDays) * 100).toFixed(2))
      : 0;

    const updateData: Partial<Contract> = {
      totalDaysPaid: newTotalDaysPaid,
      ownershipProgress: Math.min(newProgress, 100),
      durationDays: Math.max(0, contract.durationDays - invoice.extensionDays),
      totalAmount: Math.max(0, contract.totalAmount - invoice.amount - (invoice.lateFee || 0)),
    };

    // If contract was completed by this payment, revert to ACTIVE
    if (contract.status === ContractStatus.COMPLETED && contract.completedAt) {
      updateData.status = ContractStatus.ACTIVE;
      updateData.completedAt = null;
    }

    await this.contractRepo.update(invoice.contractId, updateData);
  }

  async revertInvoiceStatus(invoiceId: string, adminId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (invoice.status === PaymentStatus.PENDING) {
      throw new Error('Invoice sudah berstatus PENDING, tidak bisa di-revert');
    }

    const previousStatus = invoice.status;

    // If reverting from PAID, undo contract changes
    if (previousStatus === PaymentStatus.PAID) {
      await this.revertPaymentFromContract(invoice);
    }

    const updated = await this.invoiceRepo.update(invoiceId, {
      status: PaymentStatus.PENDING,
      paidAt: null,
    });
    if (!updated) throw new Error('Failed to update invoice');

    await this.auditRepo.create({
      id: uuidv4(),
      userId: adminId,
      action: AuditAction.UPDATE,
      module: 'invoice',
      entityId: invoiceId,
      description: `Reverted invoice ${invoice.invoiceNumber} from ${previousStatus} to PENDING`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        previousStatus,
        amount: invoice.amount,
        lateFee: invoice.lateFee,
        extensionDays: invoice.extensionDays,
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
