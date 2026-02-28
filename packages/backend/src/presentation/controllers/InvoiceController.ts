import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../../application/services';
import { PaymentStatus } from '../../domain/enums';

export class InvoiceController {
  constructor(private invoiceService: InvoiceService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { customerId } = req.query;
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
}
