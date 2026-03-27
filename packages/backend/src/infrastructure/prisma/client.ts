import { PrismaClient } from '@prisma/client';

// Connection pool configuration:
// Prisma uses a built-in connection pool. Configure via DATABASE_URL query params:
//   ?connection_limit=10&pool_timeout=30
//
// Railway default: 100 connections. Recommended for single instance: 10-20.
// For multiple instances, divide total connections by instance count.
// Example: DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=30

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log initialization in non-production for debugging
if (process.env.NODE_ENV !== 'production') {
  console.info('Prisma client initialized');
}
