import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err.message);

  if (err.message.includes('not found')) {
    return res.status(404).json({ error: err.message });
  }

  if (err.message.includes('already exists') || err.message.includes('Invalid')) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: 'Internal server error' });
}
