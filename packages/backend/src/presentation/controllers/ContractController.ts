import { Request, Response, NextFunction } from 'express';
import { ContractService } from '../../application/services';
import { sanitizePaginationParams } from '../utils/queryParams';
import {
  CreateContractDto,
  UpdateContractStatusDto,
  ExtendContractDto,
  UpdateContractDto,
  CancelContractDto,
} from '../../application/dtos';

export class ContractController {
  constructor(private contractService: ContractService) {}

  receiveUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bastPhoto, bastNotes } = req.body;
      if (!bastPhoto) {
        return res.status(400).json({ error: 'Foto BAST wajib dilampirkan' });
      }
      const contract = await this.contractService.receiveUnit(
        req.params.id,
        req.user!.id,
        bastPhoto,
        bastNotes,
      );
      res.json(contract);
    } catch (error) {
      next(error);
    }
  };

  editContract = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = UpdateContractDto.parse(req.body);
      const contract = await this.contractService.editContract(req.params.id, dto, req.user!.id);
      res.json(contract);
    } catch (error) {
      next(error);
    }
  };

  cancelContract = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = CancelContractDto.parse(req.body);
      const contract = await this.contractService.cancelContract(req.params.id, dto, req.user!.id);
      res.json(contract);
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, motorModel, batteryType, dpScheme, dpFullyPaid } = req.query;
      const params = sanitizePaginationParams(req.query as Record<string, unknown>, [
        'createdAt',
        'contractNumber',
        'startDate',
        'endDate',
        'status',
        'dailyRate',
        'totalDaysPaid',
        'ownershipProgress',
      ]);
      if (req.query.page) {
        const result = await this.contractService.getAllPaginated({
          ...params,
          status: status as string,
          motorModel: motorModel as string,
          batteryType: batteryType as string,
          dpScheme: dpScheme as string,
          dpFullyPaid: dpFullyPaid as string,
        });
        return res.json(result);
      }
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

  extend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = ExtendContractDto.parse(req.body);
      const result = await this.contractService.extend(req.params.id, dto, req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  repossess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contract = await this.contractService.repossess(req.params.id, req.user!.id);
      res.json(contract);
    } catch (error) {
      next(error);
    }
  };

  getOverdueWarnings = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const warnings = await this.contractService.getOverdueWarnings();
      res.json(warnings);
    } catch (error) {
      next(error);
    }
  };

  softDelete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contract = await this.contractService.softDelete(req.params.id, req.user!.id);
      res.json(contract);
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
