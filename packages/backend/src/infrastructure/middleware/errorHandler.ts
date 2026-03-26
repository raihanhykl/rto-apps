import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err.message);

  // Determine HTTP status based on error message patterns
  let status = 400; // Default: client error (business logic violations)

  if (err.message.includes('not found') || err.message.includes('tidak ditemukan')) {
    status = 404;
  } else if (
    err.name === 'PrismaClientKnownRequestError' ||
    err.name === 'PrismaClientUnknownRequestError' ||
    err.message.includes('ECONNREFUSED') ||
    err.message.includes('Cannot read properties')
  ) {
    // Actual server errors — don't expose internal details
    status = 500;
    return res.status(status).json({ error: 'Internal server error' });
  }

  // For all other errors (validation, business logic, etc.), return actual message
  return res.status(status).json({ error: err.message });
}
