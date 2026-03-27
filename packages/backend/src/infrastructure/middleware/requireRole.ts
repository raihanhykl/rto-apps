import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../domain/enums';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !roles.includes(user.role as UserRole)) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }
    next();
  };
}
