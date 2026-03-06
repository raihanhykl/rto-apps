// InMemory (used for tests and local dev without DB)
export { InMemoryUserRepository } from './InMemoryUserRepository';
export { InMemoryCustomerRepository } from './InMemoryCustomerRepository';
export { InMemoryContractRepository } from './InMemoryContractRepository';
export { InMemoryInvoiceRepository } from './InMemoryInvoiceRepository';
export { InMemoryAuditLogRepository } from './InMemoryAuditLogRepository';
export { InMemorySettingRepository } from './InMemorySettingRepository';

// Prisma (used when DATABASE_URL is set)
export { PrismaUserRepository } from './PrismaUserRepository';
export { PrismaCustomerRepository } from './PrismaCustomerRepository';
export { PrismaContractRepository } from './PrismaContractRepository';
export { PrismaInvoiceRepository } from './PrismaInvoiceRepository';
export { PrismaAuditLogRepository } from './PrismaAuditLogRepository';
export { PrismaSettingRepository } from './PrismaSettingRepository';
