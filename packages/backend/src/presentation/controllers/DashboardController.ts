import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../../application/services';

export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  getStats = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await this.dashboardService.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}
