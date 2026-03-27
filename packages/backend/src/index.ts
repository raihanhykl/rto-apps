import { initSentry, Sentry } from './infrastructure/sentry';

// Initialize Sentry before anything else
initSentry();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './infrastructure/config';
import {
  InMemoryUserRepository,
  InMemoryCustomerRepository,
  InMemoryContractRepository,
  InMemoryInvoiceRepository,
  InMemoryAuditLogRepository,
  InMemorySettingRepository,
  InMemoryPaymentDayRepository,
  InMemorySavingTransactionRepository,
  InMemoryServiceRecordRepository,
  PrismaUserRepository,
  PrismaCustomerRepository,
  PrismaContractRepository,
  PrismaInvoiceRepository,
  PrismaAuditLogRepository,
  PrismaSettingRepository,
  PrismaPaymentDayRepository,
  PrismaSavingTransactionRepository,
  PrismaServiceRecordRepository,
} from './infrastructure/repositories';
import {
  AuthService,
  CustomerService,
  ContractService,
  PaymentService,
  DashboardService,
  ReportService,
  AuditService,
  SettingService,
  SavingService,
  ServiceCompensationService,
} from './application/services';
import { AuthController } from './presentation/controllers/AuthController';
import { CustomerController } from './presentation/controllers/CustomerController';
import { ContractController } from './presentation/controllers/ContractController';
import { PaymentController } from './presentation/controllers/PaymentController';
import { DashboardController } from './presentation/controllers/DashboardController';
import { ReportController } from './presentation/controllers/ReportController';
import { AuditController } from './presentation/controllers/AuditController';
import { SettingController } from './presentation/controllers/SettingController';
import { SavingController } from './presentation/controllers/SavingController';
import { ServiceRecordController } from './presentation/controllers/ServiceRecordController';
import { createRoutes } from './presentation/routes';
import { createAuthMiddleware } from './infrastructure/middleware/authMiddleware';
import { errorHandler } from './infrastructure/middleware/errorHandler';
import { seedDummyData } from './infrastructure/seed';
import { Scheduler } from './infrastructure/scheduler';
import { setupSwagger } from './infrastructure/swagger';
import { IUserRepository } from './domain/interfaces/IUserRepository';
import { ICustomerRepository } from './domain/interfaces/ICustomerRepository';
import { IContractRepository } from './domain/interfaces/IContractRepository';
import { IInvoiceRepository } from './domain/interfaces/IInvoiceRepository';
import { IAuditLogRepository } from './domain/interfaces/IAuditLogRepository';
import { ISettingRepository } from './domain/interfaces/ISettingRepository';
import { IPaymentDayRepository } from './domain/interfaces/IPaymentDayRepository';
import { ISavingTransactionRepository } from './domain/interfaces/ISavingTransactionRepository';
import { IServiceRecordRepository } from './domain/interfaces/IServiceRecordRepository';
import { SequenceGenerator } from './application/utils/SequenceGenerator';
import { PrismaClient } from '@prisma/client';
import { ITransactionManager } from './domain/interfaces/ITransactionManager';
import { PrismaTransactionManager } from './infrastructure/transactions/PrismaTransactionManager';
import { InMemoryTransactionManager } from './infrastructure/transactions/InMemoryTransactionManager';

async function bootstrap() {
  const app = express();

  // Middleware
  // Security headers
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 menit
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Terlalu banyak request, coba lagi nanti' },
    }),
  );

  // Initialize Repositories
  const usePrisma = !!process.env.DATABASE_URL;
  let prismaClient: PrismaClient | null = null;

  let userRepo: IUserRepository;
  let customerRepo: ICustomerRepository;
  let contractRepo: IContractRepository;
  let invoiceRepo: IInvoiceRepository;
  let auditRepo: IAuditLogRepository;
  let settingRepo: ISettingRepository;
  let paymentDayRepo: IPaymentDayRepository;
  let savingTxRepo: ISavingTransactionRepository;
  let serviceRecordRepo: IServiceRecordRepository;

  if (usePrisma) {
    const { prisma } = await import('./infrastructure/prisma/client');
    prismaClient = prisma;
    await prisma.$connect();
    console.log('Connected to PostgreSQL');

    userRepo = new PrismaUserRepository(prisma);
    customerRepo = new PrismaCustomerRepository(prisma);
    contractRepo = new PrismaContractRepository(prisma);
    invoiceRepo = new PrismaInvoiceRepository(prisma);
    auditRepo = new PrismaAuditLogRepository(prisma);
    settingRepo = new PrismaSettingRepository(prisma);
    paymentDayRepo = new PrismaPaymentDayRepository(prisma);
    savingTxRepo = new PrismaSavingTransactionRepository(prisma);
    serviceRecordRepo = new PrismaServiceRecordRepository(prisma);
  } else {
    console.log('Using In-Memory repositories');
    userRepo = new InMemoryUserRepository();
    customerRepo = new InMemoryCustomerRepository();
    contractRepo = new InMemoryContractRepository();
    invoiceRepo = new InMemoryInvoiceRepository();
    auditRepo = new InMemoryAuditLogRepository();
    settingRepo = new InMemorySettingRepository();
    paymentDayRepo = new InMemoryPaymentDayRepository();
    savingTxRepo = new InMemorySavingTransactionRepository();
    serviceRecordRepo = new InMemoryServiceRecordRepository();
  }

  // Initialize Transaction Manager
  let txManager: ITransactionManager;
  if (usePrisma && prismaClient) {
    txManager = new PrismaTransactionManager(prismaClient);
  } else {
    txManager = new InMemoryTransactionManager({
      contractRepo,
      invoiceRepo,
      paymentDayRepo,
      auditRepo,
      savingTxRepo,
      serviceRecordRepo,
      customerRepo,
      settingRepo,
    });
  }

  // Initialize centralized sequence generator (prevents PMT number collisions)
  const sequenceGenerator = SequenceGenerator.getInstance();
  sequenceGenerator.init(contractRepo, invoiceRepo);

  // Initialize Services
  const authService = new AuthService(userRepo, auditRepo);
  const settingService = new SettingService(settingRepo, auditRepo, contractRepo);
  const customerService = new CustomerService(customerRepo, auditRepo, contractRepo);
  const contractService = new ContractService(
    contractRepo,
    customerRepo,
    invoiceRepo,
    paymentDayRepo,
    auditRepo,
    settingService,
    txManager,
  );
  const paymentService = new PaymentService(
    invoiceRepo,
    contractRepo,
    paymentDayRepo,
    auditRepo,
    settingService,
    txManager,
  );
  const savingService = new SavingService(
    savingTxRepo,
    contractRepo,
    invoiceRepo,
    auditRepo,
    txManager,
  );

  // Wire saving service ke payment service (setter injection)
  paymentService.setSavingService(savingService);

  const serviceCompensationService = new ServiceCompensationService(
    serviceRecordRepo,
    paymentDayRepo,
    contractRepo,
    invoiceRepo,
    auditRepo,
    paymentService,
    txManager,
  );
  serviceCompensationService.setSavingService(savingService);

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

  // Start scheduler for daily payments (pass prismaClient for advisory lock in production)
  const scheduler = new Scheduler(paymentService, contractService, prismaClient);
  scheduler.start();

  // Initialize Controllers
  const authController = new AuthController(authService);
  const customerController = new CustomerController(customerService);
  const contractController = new ContractController(contractService);
  const paymentController = new PaymentController(paymentService, contractService, customerService);
  const dashboardController = new DashboardController(dashboardService);
  const reportController = new ReportController(reportService, auditRepo);
  const auditController = new AuditController(auditService);
  const settingController = new SettingController(settingService);
  const savingController = new SavingController(savingService);
  const serviceRecordController = new ServiceRecordController(serviceCompensationService);

  // Auth Middleware
  const authMiddleware = createAuthMiddleware(authService);

  // Routes
  const routes = createRoutes({
    authController,
    customerController,
    contractController,
    paymentController,
    dashboardController,
    reportController,
    auditController,
    settingController,
    savingController,
    serviceRecordController,
    scheduler,
    authMiddleware,
  });

  app.use('/api', routes);

  // Swagger API Documentation
  setupSwagger(app);

  // Health check
  app.get('/health', async (_req, res) => {
    const health: Record<string, unknown> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    if (usePrisma) {
      try {
        const { prisma } = await import('./infrastructure/prisma/client');
        await prisma.$queryRaw`SELECT 1`;
        health.database = 'connected';
      } catch {
        health.database = 'disconnected';
        health.status = 'degraded';
        return res.status(503).json(health);
      }
    }

    res.json(health);
  });

  // Sentry test endpoint (development only)
  if (config.nodeEnv !== 'production') {
    app.get('/debug-sentry', () => {
      throw new Error('Sentry test error — jika muncul di dashboard, berarti Sentry bekerja!');
    });
  }

  // Sentry error handler (must be before custom error handler)
  Sentry.setupExpressErrorHandler(app);

  // Error handler
  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`WEDISON RTO Backend running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Database: ${usePrisma ? 'PostgreSQL (Prisma)' : 'In-Memory'}`);
    console.log(`API: http://localhost:${config.port}/api`);
    if (config.nodeEnv !== 'production') {
      console.log(`Default admin: admin / admin123`);
    }
    console.log(`API Docs: http://localhost:${config.port}/api-docs`);
  });

  // Graceful shutdown (handles both Prisma and InMemory modes)
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    scheduler.stop();
    server.close(async () => {
      if (usePrisma) {
        const { prisma } = await import('./infrastructure/prisma/client');
        await prisma.$disconnect();
        console.log('Prisma client disconnected');
      }
      console.log('Shutdown complete');
      process.exit(0);
    });
    // Force shutdown after 30s
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch(console.error);
