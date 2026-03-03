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
} from './application/services';
import { AuthController } from './presentation/controllers/AuthController';
import { CustomerController } from './presentation/controllers/CustomerController';
import { ContractController } from './presentation/controllers/ContractController';
import { InvoiceController } from './presentation/controllers/InvoiceController';
import { DashboardController } from './presentation/controllers/DashboardController';
import { ReportController } from './presentation/controllers/ReportController';
import { AuditController } from './presentation/controllers/AuditController';
import { SettingController } from './presentation/controllers/SettingController';
import { createRoutes } from './presentation/routes';
import { createAuthMiddleware } from './infrastructure/middleware/authMiddleware';
import { errorHandler } from './infrastructure/middleware/errorHandler';
import { seedDummyData } from './infrastructure/seed';

async function bootstrap() {
  const app = express();

  // Middleware
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());

  // Initialize Repositories (In-Memory)
  const userRepo = new InMemoryUserRepository();
  const customerRepo = new InMemoryCustomerRepository();
  const contractRepo = new InMemoryContractRepository();
  const invoiceRepo = new InMemoryInvoiceRepository();
  const auditRepo = new InMemoryAuditLogRepository();
  const settingRepo = new InMemorySettingRepository();

  // Initialize Services
  const authService = new AuthService(userRepo, auditRepo);
  const settingService = new SettingService(settingRepo, auditRepo);
  const customerService = new CustomerService(customerRepo, auditRepo, contractRepo);
  const contractService = new ContractService(contractRepo, customerRepo, invoiceRepo, auditRepo, settingService);
  const invoiceService = new InvoiceService(invoiceRepo, contractRepo, auditRepo);
  const dashboardService = new DashboardService(contractRepo, customerRepo, invoiceRepo, auditRepo);
  const reportService = new ReportService(contractRepo, customerRepo, invoiceRepo);
  const auditService = new AuditService(auditRepo);

  // Seed default data
  await authService.seedDefaultAdmin();
  await settingService.seedDefaults();

  // Seed dummy data for development
  const adminUser = await userRepo.findByUsername('admin');
  if (adminUser) {
    await seedDummyData(customerRepo, contractRepo, invoiceRepo, auditRepo, adminUser.id);
  }

  // Initialize Controllers
  const authController = new AuthController(authService);
  const customerController = new CustomerController(customerService);
  const contractController = new ContractController(contractService);
  const invoiceController = new InvoiceController(invoiceService, contractService, customerService);
  const dashboardController = new DashboardController(dashboardService);
  const reportController = new ReportController(reportService, auditRepo);
  const auditController = new AuditController(auditService);
  const settingController = new SettingController(settingService);

  // Auth Middleware
  const authMiddleware = createAuthMiddleware(authService);

  // Routes
  const routes = createRoutes({
    authController,
    customerController,
    contractController,
    invoiceController,
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
    console.log(`🚀 WEDISON RTO Backend running on port ${config.port}`);
    console.log(`📋 Environment: ${config.nodeEnv}`);
    console.log(`🔗 API: http://localhost:${config.port}/api`);
    console.log(`\n📌 Default admin: admin / admin123`);
  });
}

bootstrap().catch(console.error);
