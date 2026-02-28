import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../../application/services';
import { IAuditLogRepository } from '../../domain/interfaces';
import { AuditAction } from '../../domain/enums';
import { v4 as uuidv4 } from 'uuid';

export class ReportController {
  constructor(
    private reportService: ReportService,
    private auditRepo: IAuditLogRepository
  ) {}

  getReport = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await this.reportService.generateReport();
      res.json(report);
    } catch (error) {
      next(error);
    }
  };

  exportJSON = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const json = await this.reportService.exportJSON();

      await this.auditRepo.create({
        id: uuidv4(),
        userId: req.user!.id,
        action: AuditAction.EXPORT,
        module: 'report',
        entityId: '',
        description: 'Exported report as JSON',
        metadata: {},
        ipAddress: '',
        createdAt: new Date(),
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=wedison-report.json');
      res.send(json);
    } catch (error) {
      next(error);
    }
  };

  exportCSV = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const csv = await this.reportService.exportCSV();

      await this.auditRepo.create({
        id: uuidv4(),
        userId: req.user!.id,
        action: AuditAction.EXPORT,
        module: 'report',
        entityId: '',
        description: 'Exported report as CSV',
        metadata: {},
        ipAddress: '',
        createdAt: new Date(),
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=wedison-report.csv');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  };
}
