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

  payBilling = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.billingService.payBilling(req.params.id, req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
