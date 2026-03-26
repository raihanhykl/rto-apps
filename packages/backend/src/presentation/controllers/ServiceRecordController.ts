import { Request, Response, NextFunction } from 'express';
import { ServiceCompensationService } from '../../application/services/ServiceCompensationService';
import { CreateServiceRecordDto, RevokeServiceRecordDto } from '../../application/dtos';

export class ServiceRecordController {
  constructor(private serviceCompensationService: ServiceCompensationService) {
    this.create = this.create.bind(this);
    this.revoke = this.revoke.bind(this);
    this.getByContractId = this.getByContractId.bind(this);
    this.getById = this.getById.bind(this);
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId || 'system';
      const dto = CreateServiceRecordDto.parse(req.body);
      const record = await this.serviceCompensationService.createServiceRecord(dto, userId);
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  }

  async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId || 'system';
      const { id } = req.params;
      const dto = RevokeServiceRecordDto.parse(req.body);
      const record = await this.serviceCompensationService.revokeServiceRecord(
        id,
        dto.reason,
        userId,
      );
      res.json(record);
    } catch (error) {
      next(error);
    }
  }

  async getByContractId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contractId } = req.params;
      const records = await this.serviceCompensationService.getByContractId(contractId);
      res.json(records);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const record = await this.serviceCompensationService.getById(id);
      if (!record) {
        res.status(404).json({ error: 'Service record tidak ditemukan' });
        return;
      }
      res.json(record);
    } catch (error) {
      next(error);
    }
  }
}
