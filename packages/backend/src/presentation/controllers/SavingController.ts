import { Request, Response, NextFunction } from 'express';
import { SavingService } from '../../application/services/SavingService';
import { DebitSavingDto, ClaimSavingDto } from '../../application/dtos';
import { sanitizePaginationParams } from '../utils/queryParams';

export class SavingController {
  constructor(private savingService: SavingService) {}

  getByContractId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const [balance, transactions] = await Promise.all([
        this.savingService.getBalance(contractId),
        this.savingService.getTransactionHistory(contractId),
      ]);
      res.json({ balance, transactions });
    } catch (error) {
      next(error);
    }
  };

  getBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const balance = await this.savingService.getBalance(contractId);
      res.json({ balance });
    } catch (error) {
      next(error);
    }
  };

  debitForService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const adminId = (req as any).userId || 'system';
      const dto = DebitSavingDto.parse(req.body);
      const result = await this.savingService.debitForService(contractId, dto, adminId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  debitForTransfer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const adminId = (req as any).userId || 'system';
      const dto = DebitSavingDto.parse(req.body);
      const result = await this.savingService.debitForTransfer(contractId, dto, adminId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  claimSaving = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const adminId = (req as any).userId || 'system';
      const dto = ClaimSavingDto.parse(req.body);
      const result = await this.savingService.claimSaving(contractId, dto, adminId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  recalculateBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contractId } = req.params;
      const adminId = (req as any).userId || 'system';
      const balance = await this.savingService.recalculateBalance(contractId, adminId);
      res.json({ balance });
    } catch (error) {
      next(error);
    }
  };

  getSavingsByContract = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { page, limit } = sanitizePaginationParams(req.query as Record<string, unknown>, [
        'createdAt',
      ]);
      const result = await this.savingService.getTransactionsPaginated(id, page, limit);
      res.json({ data: result.data, total: result.total, page, limit });
    } catch (error) {
      next(error);
    }
  };
}
