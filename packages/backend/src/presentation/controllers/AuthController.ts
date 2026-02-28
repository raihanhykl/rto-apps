import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../application/services';
import { LoginDto } from '../../application/dtos';

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = LoginDto.parse(req.body);
      const result = await this.authService.login(dto);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || '';
      await this.authService.logout(token, req.user!.id);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ user: req.user });
    } catch (error) {
      next(error);
    }
  };
}
