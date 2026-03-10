import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../application/services';
import { PdfService } from '../../application/services/PdfService';
import { ContractService } from '../../application/services';
import { CustomerService } from '../../application/services';
import { PaymentStatus } from '../../domain/enums';
import { getWibToday } from '../../domain/utils/dateUtils';

export class PaymentController {
  private pdfService: PdfService;

  constructor(
    private paymentService: PaymentService,
    private contractService?: ContractService,
    private customerService?: CustomerService,
  ) {
    this.pdfService = new PdfService();
  }

  // ============ List / Detail ============

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder, search, status, customerId, invoiceType, startDate, endDate } = req.query;
      if (page) {
        const result = await this.paymentService.getAllPaginated({
          page: parseInt(page as string) || 1,
          limit: parseInt(limit as string) || 20,
          sortBy: sortBy as string,
          sortOrder: sortOrder as 'asc' | 'desc',
          search: search as string,
          status: status as string,
          customerId: customerId as string,
          invoiceType: invoiceType as string,
          startDate: startDate as string,
          endDate: endDate as string,
        });
        return res.json(result);
      }
      const payments = customerId
        ? await this.paymentService.getByCustomerId(customerId as string)
        : await this.paymentService.getAll();
      res.json(payments);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await this.paymentService.getById(req.params.id);
      res.json(payment);
    } catch (error) {
      next(error);
    }
  };

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q } = req.query;
      if (!q) return res.json([]);
      const results = await this.paymentService.search(q as string);
      res.json(results);
    } catch (error) {
      next(error);
    }
  };

  // ============ QR Code ============

  getQRCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const qrDataUrl = await this.paymentService.generateQRCode(req.params.id);
      res.json({ qrCode: qrDataUrl });
    } catch (error) {
      next(error);
    }
  };

  // ============ Payment Actions ============

  payPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.paymentService.payPayment(req.params.id, req.user!.id);
      res.json(result);
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
      const payment = await this.paymentService.simulatePayment(
        req.params.id,
        status,
        req.user!.id
      );
      res.json(payment);
    } catch (error) {
      next(error);
    }
  };

  markPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await this.paymentService.payPayment(req.params.id, req.user!.id);
      res.json(payment);
    } catch (error) {
      next(error);
    }
  };

  voidPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await this.paymentService.voidPayment(req.params.id, req.user!.id);
      res.json(payment);
    } catch (error) {
      next(error);
    }
  };

  revertStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await this.paymentService.revertPaymentStatus(req.params.id, req.user!.id);
      res.json(payment);
    } catch (error) {
      next(error);
    }
  };

  cancelPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await this.paymentService.cancelPayment(req.params.id, req.user!.id);
      res.json(payment);
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
      const result = await this.paymentService.bulkMarkPaid(invoiceIds, req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // ============ Contract-specific ============

  getByContractId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payments = await this.paymentService.getByContractId(req.params.contractId);
      res.json(payments);
    } catch (error) {
      next(error);
    }
  };

  getActiveByContractId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payment = await this.paymentService.getActivePaymentByContractId(req.params.contractId);
      res.json(payment);
    } catch (error) {
      next(error);
    }
  };

  getCalendarData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { year, month } = req.query;
      const today = getWibToday();
      const y = parseInt(year as string) || today.getFullYear();
      const m = parseInt(month as string) || (today.getMonth() + 1);
      const data = await this.paymentService.getCalendarData(req.params.contractId, y, m);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  createManualPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days } = req.body;
      if (!days || days < 1 || days > 7) {
        return res.status(400).json({ error: 'days must be between 1 and 7' });
      }
      const payment = await this.paymentService.createManualPayment(req.params.contractId, days, req.user!.id);
      res.json(payment);
    } catch (error) {
      next(error);
    }
  };

  // ============ Admin Correction ============

  updatePaymentDayStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId, date } = req.params;
      const { status, notes } = req.body;
      const adminId = (req as any).user?.id || 'system';

      const parsedDate = new Date(date + 'T00:00:00');
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }

      const result = await this.paymentService.updatePaymentDayStatus(
        contractId,
        parsedDate,
        status,
        adminId,
        notes,
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // ============ Reduce Payment ============

  reducePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { newDaysCount, notes } = req.body;
      const adminId = (req as any).user?.id || 'system';

      if (!newDaysCount || typeof newDaysCount !== 'number' || newDaysCount < 1) {
        return res.status(400).json({ error: 'newDaysCount must be a positive number' });
      }

      const result = await this.paymentService.reducePayment(id, newDaysCount, adminId, notes);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // ============ PDF ============

  downloadPdf = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this.contractService || !this.customerService) {
        return res.status(500).json({ error: 'PDF generation not configured' });
      }

      const payment = await this.paymentService.getById(req.params.id);
      const contract = await this.contractService.getById(payment.contractId);
      const customer = await this.customerService.getById(payment.customerId);

      let qrCodeDataUrl: string | undefined;
      try {
        qrCodeDataUrl = await this.paymentService.generateQRCode(req.params.id);
      } catch {
        // Skip QR if generation fails
      }

      const pdfBuffer = await this.pdfService.generateInvoicePdf(payment, contract, customer, qrCodeDataUrl);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=payment-${payment.invoiceNumber}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };
}
