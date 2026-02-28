import { Request, Response, NextFunction } from 'express';
import { ContractService } from '../../application/services';
import { CreateContractDto, UpdateContractStatusDto } from '../../application/dtos';

export class ContractController {
  constructor(private contractService: ContractService) {}

  getAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const contracts = await this.contractService.getAll();
      res.json(contracts);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contract = await this.contractService.getById(req.params.id);
      res.json(contract);
    } catch (error) {
      next(error);
    }
  };

  getDetailById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await this.contractService.getDetailById(req.params.id);
      res.json(detail);
    } catch (error) {
      next(error);
    }
  };

  getByCustomerId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contracts = await this.contractService.getByCustomerId(req.params.customerId);
      res.json(contracts);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = CreateContractDto.parse(req.body);
      const result = await this.contractService.create(dto, req.user!.id);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = UpdateContractStatusDto.parse(req.body);
      const contract = await this.contractService.updateStatus(req.params.id, dto, req.user!.id);
      res.json(contract);
    } catch (error) {
      next(error);
    }
  };
}
