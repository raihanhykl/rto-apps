import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../../application/services';
import { PdfService } from '../../application/services/PdfService';
import { ContractService } from '../../application/services';
import { CustomerService } from '../../application/services';
import { PaymentStatus } from '../../domain/enums';

export class InvoiceController {
  private pdfService: PdfService;

  constructor(
    private invoiceService: InvoiceService,
    private contractService?: ContractService,
    private customerService?: CustomerService,
  ) {
    this.pdfService = new PdfService();
  }

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder, search, status, customerId } = req.query;
      if (page) {
        const result = await this.invoiceService.getAllPaginated({
          page: parseInt(page as string) || 1,
          limit: parseInt(limit as string) || 20,
          sortBy: sortBy as string,
          sortOrder: sortOrder as 'asc' | 'desc',
          search: search as string,
          status: status as string,
          customerId: customerId as string,
        });
        return res.json(result);
      }
      const invoices = customerId
        ? await this.invoiceService.getByCustomerId(customerId as string)
        : await this.invoiceService.getAll();
      res.json(invoices);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.invoiceService.getById(req.params.id);
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  };

  getQRCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const qrDataUrl = await this.invoiceService.generateQRCode(req.params.id);
      res.json({ qrCode: qrDataUrl });
    } catch (error) {
      next(error);
    }
  };

  simulatePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      if (status !== PaymentStatus.PAID && status !== PaymentStatus.FAILED) {
        return res.status(400).json({ error: 'Status must be PAID or FAILED' });
      }
      const invoice = await this.invoiceService.simulatePayment(
        req.params.id,
        status,
        req.user!.id
      );
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  };

  voidInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.invoiceService.voidInvoice(req.params.id, req.user!.id);
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  };

  markPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.invoiceService.markPaid(req.params.id, req.user!.id);
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  };

  revertStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await this.invoiceService.revertInvoiceStatus(req.params.id, req.user!.id);
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  };

  bulkMarkPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { invoiceIds } = req.body;
      if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ error: 'invoiceIds must be a non-empty array' });
      }
      const result = await this.invoiceService.bulkMarkPaid(invoiceIds, req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  downloadPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.contractService || !this.customerService) {
        return res.status(500).json({ error: 'PDF generation not configured' });
      }

      const invoice = await this.invoiceService.getById(req.params.id);
      const contract = await this.contractService.getById(invoice.contractId);
      const customer = await this.customerService.getById(invoice.customerId);

      let qrCodeDataUrl: string | undefined;
      try {
        qrCodeDataUrl = await this.invoiceService.generateQRCode(req.params.id);
      } catch {
        // Skip QR if generation fails
      }

      const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice, contract, customer, qrCodeDataUrl);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };
}
