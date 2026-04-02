import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../../application/services';
import { CreateCustomerDto, UpdateCustomerDto } from '../../application/dtos';
import { sanitizePaginationParams } from '../utils/queryParams';

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gender } = req.query;
      const params = sanitizePaginationParams(req.query as Record<string, unknown>, [
        'createdAt',
        'fullName',
        'phone',
        'email',
        'ktpNumber',
      ]);
      if (req.query.page) {
        const result = await this.customerService.getAllPaginated({
          ...params,
          gender: gender as string,
        });
        return res.json(result);
      }
      const customers = params.search
        ? await this.customerService.search(params.search)
        : await this.customerService.getAll();
      res.json(customers);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customer = await this.customerService.getById(req.params.id);
      res.json(customer);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = CreateCustomerDto.parse(req.body);
      const customer = await this.customerService.create(dto, req.user!.id);
      res.status(201).json(customer);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = UpdateCustomerDto.parse(req.body);
      const customer = await this.customerService.update(req.params.id, dto, req.user!.id);
      res.json(customer);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.customerService.delete(req.params.id, req.user!.id);
      res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
