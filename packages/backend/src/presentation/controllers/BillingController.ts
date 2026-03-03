import { Request, Response, NextFunction } from 'express';
import { BillingService } from '../../application/services';

export class BillingController {
  constructor(private billingService: BillingService) {}

  getByContractId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const billings = await this.billingService.getBillingsByContractId(req.params.contractId);
      res.json(billings);
    } catch (error) {
      next(error);
    }
  };

  getActiveByContractId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const billing = await this.billingService.getActiveBillingByContractId(req.params.contractId);
      res.json(billing);
    } catch (error) {
      next(error);
    }
  };

  getCalendarData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { year, month } = req.query;
      const y = parseInt(year as string) || new Date().getFullYear();
      const m = parseInt(month as string) || (new Date().getMonth() + 1);
      const data = await this.billingService.getCalendarData(req.params.contractId, y, m);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  payBilling = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.billingService.payBilling(req.params.id, req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createManualBilling = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days } = req.body;
      if (!days || days < 1 || days > 7) {
        return res.status(400).json({ error: 'days must be between 1 and 7' });
      }
      const billing = await this.billingService.createManualBilling(req.params.contractId, days, req.user!.id);
      res.json(billing);
    } catch (error) {
      next(error);
    }
  };

  cancelBilling = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const billing = await this.billingService.cancelBilling(req.params.id, req.user!.id);
      res.json(billing);
    } catch (error) {
      next(error);
    }
  };
}
