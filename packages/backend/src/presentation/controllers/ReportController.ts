import { Request, Response, NextFunction } from 'express';
import { ReportService, ReportFilters } from '../../application/services/ReportService';
import { IAuditLogRepository } from '../../domain/interfaces';
import { AuditAction, ContractStatus, MotorModel, BatteryType } from '../../domain/enums';
import { v4 as uuidv4 } from 'uuid';

export class ReportController {
  constructor(
    private reportService: ReportService,
    private auditRepo: IAuditLogRepository
  ) {}

  private parseFilters(query: any): ReportFilters {
    const filters: ReportFilters = {};
    if (query.startDate) filters.startDate = query.startDate as string;
    if (query.endDate) filters.endDate = query.endDate as string;
    if (query.status && Object.values(ContractStatus).includes(query.status)) {
      filters.status = query.status as ContractStatus;
    }
    if (query.motorModel && Object.values(MotorModel).includes(query.motorModel)) {
      filters.motorModel = query.motorModel as MotorModel;
    }
    if (query.batteryType && Object.values(BatteryType).includes(query.batteryType)) {
      filters.batteryType = query.batteryType as BatteryType;
    }
    return filters;
  }

  getReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = this.parseFilters(req.query);
      const report = await this.reportService.generateReport(filters);
      res.json(report);
    } catch (error) {
      next(error);
    }
  };

  exportJSON = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = this.parseFilters(req.query);
      const json = await this.reportService.exportJSON(filters);

      await this.auditRepo.create({
        id: uuidv4(),
        userId: req.user!.id,
        action: AuditAction.EXPORT,
        module: 'report',
        entityId: '',
        description: 'Exported report as JSON',
        metadata: { filters },
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
      const filters = this.parseFilters(req.query);
      const csv = await this.reportService.exportCSV(filters);

      await this.auditRepo.create({
        id: uuidv4(),
        userId: req.user!.id,
        action: AuditAction.EXPORT,
        module: 'report',
        entityId: '',
        description: 'Exported report as CSV',
        metadata: { filters },
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

  exportXLSV = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = this.parseFilters(req.query);
      const xlsv = await this.reportService.exportXLSV(filters);

      await this.auditRepo.create({
        id: uuidv4(),
        userId: req.user!.id,
        action: AuditAction.EXPORT,
        module: 'report',
        entityId: '',
        description: 'Exported report as XLSV (Excel-compatible)',
        metadata: { filters },
        ipAddress: '',
        createdAt: new Date(),
      });

      res.setHeader('Content-Type', 'text/tab-separated-values');
      res.setHeader('Content-Disposition', 'attachment; filename=wedison-report.xls');
      res.send(xlsv);
    } catch (error) {
      next(error);
    }
  };
}
