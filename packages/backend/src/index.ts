import express from 'express';
import cors from 'cors';
import { config } from './infrastructure/config';
import {
  InMemoryUserRepository,
  InMemoryCustomerRepository,
  InMemoryContractRepository,
  InMemoryInvoiceRepository,
  InMemoryAuditLogRepository,
  InMemorySettingRepository,
  InMemoryBillingRepository,
  PrismaUserRepository,
  PrismaCustomerRepository,
  PrismaContractRepository,
  PrismaInvoiceRepository,
  PrismaAuditLogRepository,
  PrismaSettingRepository,
  PrismaBillingRepository,
} from './infrastructure/repositories';
import {
  AuthService,
  CustomerService,
  ContractService,
  InvoiceService,
  DashboardService,
  ReportService,
  AuditService,
  SettingService,
  BillingService,
} from './application/services';
import { AuthController } from './presentation/controllers/AuthController';
import { CustomerController } from './presentation/controllers/CustomerController';
import { ContractController } from './presentation/controllers/ContractController';
import { InvoiceController } from './presentation/controllers/InvoiceController';
import { DashboardController } from './presentation/controllers/DashboardController';
import { ReportController } from './presentation/controllers/ReportController';
import { AuditController } from './presentation/controllers/AuditController';
import { SettingController } from './presentation/controllers/SettingController';
import { BillingController } from './presentation/controllers/BillingController';
import { createRoutes } from './presentation/routes';
import { createAuthMiddleware } from './infrastructure/middleware/authMiddleware';
import { errorHandler } from './infrastructure/middleware/errorHandler';
import { seedDummyData } from './infrastructure/seed';
import { Scheduler } from './infrastructure/scheduler';
import { IUserRepository } from './domain/interfaces/IUserRepository';
import { ICustomerRepository } from './domain/interfaces/ICustomerRepository';
import { IContractRepository } from './domain/interfaces/IContractRepository';
import { IInvoiceRepository } from './domain/interfaces/IInvoiceRepository';
import { IAuditLogRepository } from './domain/interfaces/IAuditLogRepository';
import { ISettingRepository } from './domain/interfaces/ISettingRepository';
import { IBillingRepository } from './domain/interfaces/IBillingRepository';

async function bootstrap() {
  const app = express();

  // Middleware
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());

  // Initialize Repositories
  const usePrisma = !!process.env.DATABASE_URL;

  let userRepo: IUserRepository;
  let customerRepo: ICustomerRepository;
  let contractRepo: IContractRepository;
  let invoiceRepo: IInvoiceRepository;
  let auditRepo: IAuditLogRepository;
  let settingRepo: ISettingRepository;
  let billingRepo: IBillingRepository;

  if (usePrisma) {
    const { prisma } = await import('./infrastructure/prisma/client');
    await prisma.$connect();
    console.log('Connected to PostgreSQL');

    userRepo = new PrismaUserRepository(prisma);
    customerRepo = new PrismaCustomerRepository(prisma);
    contractRepo = new PrismaContractRepository(prisma);
    invoiceRepo = new PrismaInvoiceRepository(prisma);
    auditRepo = new PrismaAuditLogRepository(prisma);
    settingRepo = new PrismaSettingRepository(prisma);
    billingRepo = new PrismaBillingRepository(prisma);
  } else {
    console.log('Using In-Memory repositories');
    userRepo = new InMemoryUserRepository();
    customerRepo = new InMemoryCustomerRepository();
    contractRepo = new InMemoryContractRepository();
    invoiceRepo = new InMemoryInvoiceRepository();
    auditRepo = new InMemoryAuditLogRepository();
    settingRepo = new InMemorySettingRepository();
    billingRepo = new InMemoryBillingRepository();
  }

  // Initialize Services
  const authService = new AuthService(userRepo, auditRepo);
  const settingService = new SettingService(settingRepo, auditRepo);
  const customerService = new CustomerService(customerRepo, auditRepo, contractRepo);
  const contractService = new ContractService(contractRepo, customerRepo, invoiceRepo, auditRepo, settingService);
  const invoiceService = new InvoiceService(invoiceRepo, contractRepo, auditRepo);
  const billingService = new BillingService(billingRepo, contractRepo, invoiceRepo, auditRepo, settingService);
  const dashboardService = new DashboardService(contractRepo, customerRepo, invoiceRepo, auditRepo);
  const reportService = new ReportService(contractRepo, customerRepo, invoiceRepo);
  const auditService = new AuditService(auditRepo);

  // Seed default data (idempotent - works with both InMemory and Prisma)
  await authService.seedDefaultAdmin();
  await settingService.seedDefaults();

  // Seed dummy data only for InMemory mode (development)
  if (!usePrisma) {
    const adminUser = await userRepo.findByUsername('admin');
    if (adminUser) {
      await seedDummyData(customerRepo, contractRepo, invoiceRepo, auditRepo, adminUser.id);
    }
  }

  // Start scheduler for daily billing
  const scheduler = new Scheduler(billingService, contractService);
  scheduler.start();

  // Initialize Controllers
  const authController = new AuthController(authService);
  const customerController = new CustomerController(customerService);
  const contractController = new ContractController(contractService);
  const invoiceController = new InvoiceController(invoiceService, contractService, customerService);
  const dashboardController = new DashboardController(dashboardService);
  const reportController = new ReportController(reportService, auditRepo);
  const auditController = new AuditController(auditService);
  const settingController = new SettingController(settingService);
  const billingController = new BillingController(billingService);

  // Auth Middleware
  const authMiddleware = createAuthMiddleware(authService);

  // Routes
  const routes = createRoutes({
    authController,
    customerController,
    contractController,
    invoiceController,
    billingController,
    dashboardController,
    reportController,
    auditController,
    settingController,
    authMiddleware,
  });

  app.use('/api', routes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler
  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`WEDISON RTO Backend running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Database: ${usePrisma ? 'PostgreSQL (Prisma)' : 'In-Memory'}`);
    console.log(`API: http://localhost:${config.port}/api`);
    console.log(`Default admin: admin / admin123`);
  });

  // Graceful shutdown
  if (usePrisma) {
    const shutdown = async () => {
      console.log('Shutting down...');
      scheduler.stop();
      const { prisma } = await import('./infrastructure/prisma/client');
      await prisma.$disconnect();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}

bootstrap().catch(console.error);
