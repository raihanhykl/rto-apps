import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { CustomerController } from '../controllers/CustomerController';
import { ContractController } from '../controllers/ContractController';
import { PaymentController } from '../controllers/PaymentController';
import { DashboardController } from '../controllers/DashboardController';
import { ReportController } from '../controllers/ReportController';
import { AuditController } from '../controllers/AuditController';
import { SettingController } from '../controllers/SettingController';
import { SavingController } from '../controllers/SavingController';

interface RouteControllers {
  authController: AuthController;
  customerController: CustomerController;
  contractController: ContractController;
  paymentController: PaymentController;
  dashboardController: DashboardController;
  reportController: ReportController;
  auditController: AuditController;
  settingController: SettingController;
  savingController: SavingController;
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

  // Payments (unified billing + invoice)
  router.get('/payments', authMiddleware, controllers.paymentController.getAll);
  router.get('/payments/search', authMiddleware, controllers.paymentController.search);
  router.get('/payments/contract/:contractId', authMiddleware, controllers.paymentController.getByContractId);
  router.get('/payments/contract/:contractId/active', authMiddleware, controllers.paymentController.getActiveByContractId);
  router.get('/payments/contract/:contractId/calendar', authMiddleware, controllers.paymentController.getCalendarData);
  router.post('/payments/contract/:contractId/manual', authMiddleware, controllers.paymentController.createManualPayment);
  router.patch('/payments/contract/:contractId/day/:date', authMiddleware, controllers.paymentController.updatePaymentDayStatus);
  router.post('/payments/bulk-pay', authMiddleware, controllers.paymentController.bulkMarkPaid);
  router.get('/payments/:id', authMiddleware, controllers.paymentController.getById);
  router.get('/payments/:id/qr', authMiddleware, controllers.paymentController.getQRCode);
  router.get('/payments/:id/pdf', authMiddleware, controllers.paymentController.downloadPdf);
  router.post('/payments/:id/pay', authMiddleware, controllers.paymentController.payPayment);
  router.post('/payments/:id/simulate', authMiddleware, controllers.paymentController.simulatePayment);
  router.patch('/payments/:id/mark-paid', authMiddleware, controllers.paymentController.markPaid);
  router.patch('/payments/:id/void', authMiddleware, controllers.paymentController.voidPayment);
  router.patch('/payments/:id/revert', authMiddleware, controllers.paymentController.revertStatus);
  router.patch('/payments/:id/cancel', authMiddleware, controllers.paymentController.cancelPayment);
  router.post('/payments/:id/reduce', authMiddleware, controllers.paymentController.reducePayment);

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

  // Saving
  router.get('/savings/contract/:contractId', authMiddleware, controllers.savingController.getByContractId);
  router.get('/savings/contract/:contractId/balance', authMiddleware, controllers.savingController.getBalance);
  router.post('/savings/contract/:contractId/debit/service', authMiddleware, controllers.savingController.debitForService);
  router.post('/savings/contract/:contractId/debit/transfer', authMiddleware, controllers.savingController.debitForTransfer);
  router.post('/savings/contract/:contractId/claim', authMiddleware, controllers.savingController.claimSaving);
  router.post('/savings/contract/:contractId/recalculate', authMiddleware, controllers.savingController.recalculateBalance);

  return router;
}
