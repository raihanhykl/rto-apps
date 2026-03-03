import { Request, Response, NextFunction } from 'express';
import { ContractService } from '../../application/services';
import { CreateContractDto, UpdateContractStatusDto, ExtendContractDto, UpdateContractDto, CancelContractDto } from '../../application/dtos';

export class ContractController {
  constructor(private contractService: ContractService) {}

  receiveUnit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bastPhoto, bastNotes } = req.body;
      if (!bastPhoto) {
        return res.status(400).json({ error: 'Foto BAST wajib dilampirkan' });
      }
      const contract = await this.contractService.receiveUnit(req.params.id, req.user!.id, bastPhoto, bastNotes);
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
      const { page, limit, sortBy, sortOrder, search, status } = req.query;
      if (page) {
        const result = await this.contractService.getAllPaginated({
          page: parseInt(page as string) || 1,
          limit: parseInt(limit as string) || 20,
          sortBy: sortBy as string,
          sortOrder: sortOrder as 'asc' | 'desc',
          search: search as string,
          status: status as string,
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
