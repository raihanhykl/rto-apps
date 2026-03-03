import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../../application/services';

export class AuditController {
  constructor(private auditService: AuditService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, sortBy, sortOrder, search, module, userId } = req.query;
      if (page) {
        const result = await this.auditService.getAllPaginated({
          page: parseInt(page as string) || 1,
          limit: parseInt(limit as string) || 20,
          sortBy: sortBy as string,
          sortOrder: sortOrder as 'asc' | 'desc',
          search: search as string,
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
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await this.auditService.getRecent(limit);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  };
}
