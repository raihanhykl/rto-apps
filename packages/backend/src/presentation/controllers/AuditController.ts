import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../../application/services';
import { sanitizePaginationParams } from '../utils/queryParams';

export class AuditController {
  constructor(private auditService: AuditService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { module, userId } = req.query;
      const params = sanitizePaginationParams(req.query as Record<string, unknown>, [
        'createdAt',
        'action',
        'module',
        'userId',
      ]);
      if (req.query.page) {
        const result = await this.auditService.getAllPaginated({
          ...params,
          module: module as string,
        });
        return res.json(result);
      }
      let logs;
      if (module) {
        logs = await this.auditService.getByModule(module as string);
      } else if (userId) {
        logs = await this.auditService.getByUserId(userId as string);
      } else {
        logs = await this.auditService.getAll();
      }
      res.json(logs);
    } catch (error) {
      next(error);
    }
  };

  getRecent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 50));
      const logs = await this.auditService.getRecent(limit);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  };
}
