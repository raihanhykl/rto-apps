import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { CustomerController } from '../controllers/CustomerController';
import { ContractController } from '../controllers/ContractController';
import { InvoiceController } from '../controllers/InvoiceController';
import { DashboardController } from '../controllers/DashboardController';
import { ReportController } from '../controllers/ReportController';
import { AuditController } from '../controllers/AuditController';
import { SettingController } from '../controllers/SettingController';
import { BillingController } from '../controllers/BillingController';

interface RouteControllers {
  authController: AuthController;
  customerController: CustomerController;
  contractController: ContractController;
  invoiceController: InvoiceController;
  billingController: BillingController;
  dashboardController: DashboardController;
  reportController: ReportController;
  auditController: AuditController;
  settingController: SettingController;
  authMiddleware: any;
}

export function createRoutes(controllers: RouteControllers): Router {
  const router = Router();
  const { authMiddleware } = controllers;

  // Auth routes (no auth required for login)
  router.post('/auth/login', controllers.authController.login);
  router.post('/auth/logout', authMiddleware, controllers.authController.logout);
  router.get('/auth/me', authMiddleware, controllers.authController.me);

  // Dashboard
  router.get('/dashboard/stats', authMiddleware, controllers.dashboardController.getStats);

  // Customers
  router.get('/customers', authMiddleware, controllers.customerController.getAll);
  router.get('/customers/:id', authMiddleware, controllers.customerController.getById);
  router.post('/customers', authMiddleware, controllers.customerController.create);
  router.put('/customers/:id', authMiddleware, controllers.customerController.update);
  router.delete('/customers/:id', authMiddleware, controllers.customerController.delete);

  // Contracts
  router.get('/contracts', authMiddleware, controllers.contractController.getAll);
  router.get('/contracts/overdue-warnings', authMiddleware, controllers.contractController.getOverdueWarnings);
  router.get('/contracts/customer/:customerId', authMiddleware, controllers.contractController.getByCustomerId);
  router.get('/contracts/:id/detail', authMiddleware, controllers.contractController.getDetailById);
  router.get('/contracts/:id', authMiddleware, controllers.contractController.getById);
  router.post('/contracts', authMiddleware, controllers.contractController.create);
  router.post('/contracts/:id/extend', authMiddleware, controllers.contractController.extend);
  router.patch('/contracts/:id/receive-unit', authMiddleware, controllers.contractController.receiveUnit);
  router.patch('/contracts/:id/repossess', authMiddleware, controllers.contractController.repossess);
  router.put('/contracts/:id', authMiddleware, controllers.contractController.editContract);
  router.patch('/contracts/:id/cancel', authMiddleware, controllers.contractController.cancelContract);
  router.delete('/contracts/:id', authMiddleware, controllers.contractController.softDelete);
  router.patch('/contracts/:id/status', authMiddleware, controllers.contractController.updateStatus);

  // Invoices
  router.get('/invoices', authMiddleware, controllers.invoiceController.getAll);
  router.get('/invoices/:id', authMiddleware, controllers.invoiceController.getById);
  router.get('/invoices/:id/qr', authMiddleware, controllers.invoiceController.getQRCode);
  router.post('/invoices/:id/payment', authMiddleware, controllers.invoiceController.simulatePayment);
  router.patch('/invoices/:id/void', authMiddleware, controllers.invoiceController.voidInvoice);
  router.patch('/invoices/:id/mark-paid', authMiddleware, controllers.invoiceController.markPaid);
  router.patch('/invoices/:id/revert', authMiddleware, controllers.invoiceController.revertStatus);
  router.post('/invoices/bulk-pay', authMiddleware, controllers.invoiceController.bulkMarkPaid);

  // Invoices - PDF
  router.get('/invoices/:id/pdf', authMiddleware, controllers.invoiceController.downloadPdf);

  // Billings
  router.get('/billings/contract/:contractId', authMiddleware, controllers.billingController.getByContractId);
  router.get('/billings/contract/:contractId/active', authMiddleware, controllers.billingController.getActiveByContractId);
  router.post('/billings/:id/pay', authMiddleware, controllers.billingController.payBilling);

  // Reports
  router.get('/reports', authMiddleware, controllers.reportController.getReport);
  router.get('/reports/export/json', authMiddleware, controllers.reportController.exportJSON);
  router.get('/reports/export/csv', authMiddleware, controllers.reportController.exportCSV);
  router.get('/reports/export/xlsv', authMiddleware, controllers.reportController.exportXLSV);

  // Audit Logs
  router.get('/audit-logs', authMiddleware, controllers.auditController.getAll);
  router.get('/audit-logs/recent', authMiddleware, controllers.auditController.getRecent);

  // Settings
  router.get('/settings', authMiddleware, controllers.settingController.getAll);
  router.get('/settings/rates', authMiddleware, (_req, res) => {
    const { MOTOR_DAILY_RATES } = require('../../domain/enums');
    res.json(MOTOR_DAILY_RATES);
  });
  router.put('/settings', authMiddleware, controllers.settingController.update);

  return router;
}
