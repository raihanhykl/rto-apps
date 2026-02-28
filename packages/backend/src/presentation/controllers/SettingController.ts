import { Request, Response, NextFunction } from 'express';
import { SettingService } from '../../application/services';
import { UpdateSettingDto } from '../../application/dtos';

export class SettingController {
  constructor(private settingService: SettingService) {}

  getAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await this.settingService.getAll();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = UpdateSettingDto.parse(req.body);
      const setting = await this.settingService.update(dto, req.user!.id);
      res.json(setting);
    } catch (error) {
      next(error);
    }
  };
}
