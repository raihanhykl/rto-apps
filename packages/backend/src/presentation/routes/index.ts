import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { CustomerController } from '../controllers/CustomerController';
import { ContractController } from '../controllers/ContractController';
import { PaymentController } from '../controllers/PaymentController';
import { DashboardController } from '../controllers/DashboardController';
import { ReportController } from '../controllers/ReportController';
import { AuditController } from '../controllers/AuditController';
import { SettingController } from '../controllers/SettingController';
import { SavingController } from '../controllers/SavingController';
import { ServiceRecordController } from '../controllers/ServiceRecordController';
import { MOTOR_DAILY_RATES, UserRole } from '../../domain/enums';
import { Scheduler } from '../../infrastructure/scheduler';
import { requireRole } from '../../infrastructure/middleware/requireRole';
import { AuthService } from '../../application/services';

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
  serviceRecordController: ServiceRecordController;
  scheduler: Scheduler;
  authMiddleware: RequestHandler;
  authService: AuthService;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { error: 'Terlalu banyak percobaan login, coba lagi setelah 15 menit' },
});

export function createRoutes(controllers: RouteControllers): Router {
  const router = Router();
  const { authMiddleware } = controllers;

  // Auth routes (no auth required for login and refresh)
  router.post('/auth/login', loginLimiter, async (req, res, next) => {
    try {
      const result = await controllers.authService.login(req.body);
      if (result.refreshToken) {
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/api/auth',
        });
      }
      // Return access token + user (without refreshToken in body)
      res.json({ token: result.token, user: result.user });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/refresh', async (req, res, next) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token' });
      }
      const result = await controllers.authService.refresh(refreshToken);
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth',
      });
      res.json({ token: result.accessToken });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/logout', authMiddleware, async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || '';
      await controllers.authService.logout(token, req.user!.id);
      res.clearCookie('refreshToken', { path: '/api/auth' });
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  });

  router.get('/auth/me', authMiddleware, controllers.authController.me);

  // Dashboard
  router.get('/dashboard/stats', authMiddleware, controllers.dashboardController.getStats);

  // Customers
  router.get('/customers', authMiddleware, controllers.customerController.getAll);
  router.get('/customers/:id', authMiddleware, controllers.customerController.getById);
  router.post(
    '/customers',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.customerController.create,
  );
  router.put(
    '/customers/:id',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.customerController.update,
  );
  router.delete(
    '/customers/:id',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN),
    controllers.customerController.delete,
  );

  // Contracts
  router.get('/contracts', authMiddleware, controllers.contractController.getAll);
  router.get(
    '/contracts/overdue-warnings',
    authMiddleware,
    controllers.contractController.getOverdueWarnings,
  );
  router.get(
    '/contracts/customer/:customerId',
    authMiddleware,
    controllers.contractController.getByCustomerId,
  );
  router.get('/contracts/:id/detail', authMiddleware, controllers.contractController.getDetailById);
  router.get(
    '/contracts/:id/invoices',
    authMiddleware,
    controllers.paymentController.getInvoicesByContract,
  );
  router.get(
    '/contracts/:id/savings',
    authMiddleware,
    controllers.savingController.getSavingsByContract,
  );
  router.get('/contracts/:id', authMiddleware, controllers.contractController.getById);
  router.post(
    '/contracts',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.contractController.create,
  );
  router.post(
    '/contracts/:id/extend',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.contractController.extend,
  );
  router.patch(
    '/contracts/:id/receive-unit',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.contractController.receiveUnit,
  );
  router.patch(
    '/contracts/:id/repossess',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.contractController.repossess,
  );
  router.put(
    '/contracts/:id',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.contractController.editContract,
  );
  router.patch(
    '/contracts/:id/cancel',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.contractController.cancelContract,
  );
  router.delete(
    '/contracts/:id',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN),
    controllers.contractController.softDelete,
  );
  router.patch(
    '/contracts/:id/status',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.contractController.updateStatus,
  );

  // Payments (unified billing + invoice)
  router.get('/payments', authMiddleware, controllers.paymentController.getAll);
  router.get('/payments/search', authMiddleware, controllers.paymentController.search);
  router.get(
    '/payments/contract/:contractId',
    authMiddleware,
    controllers.paymentController.getByContractId,
  );
  router.get(
    '/payments/contract/:contractId/active',
    authMiddleware,
    controllers.paymentController.getActiveByContractId,
  );
  router.get(
    '/payments/contract/:contractId/calendar',
    authMiddleware,
    controllers.paymentController.getCalendarData,
  );
  router.get(
    '/payments/contract/:contractId/manual-preview',
    authMiddleware,
    controllers.paymentController.previewManualPayment,
  );
  router.post(
    '/payments/contract/:contractId/manual',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.paymentController.createManualPayment,
  );
  router.patch(
    '/payments/contract/:contractId/day/:date',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.paymentController.updatePaymentDayStatus,
  );
  router.post(
    '/payments/bulk-pay',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.paymentController.bulkMarkPaid,
  );
  router.get('/payments/:id', authMiddleware, controllers.paymentController.getById);
  router.get('/payments/:id/qr', authMiddleware, controllers.paymentController.getQRCode);
  router.get('/payments/:id/pdf', authMiddleware, controllers.paymentController.downloadPdf);
  router.post(
    '/payments/:id/pay',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.paymentController.payPayment,
  );
  router.post(
    '/payments/:id/simulate',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.paymentController.simulatePayment,
  );
  router.patch(
    '/payments/:id/mark-paid',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.paymentController.markPaid,
  );
  router.patch(
    '/payments/:id/void',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.paymentController.voidPayment,
  );
  router.patch(
    '/payments/:id/revert',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.paymentController.revertStatus,
  );
  router.patch(
    '/payments/:id/cancel',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.paymentController.cancelPayment,
  );
  router.post(
    '/payments/:id/reduce',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.paymentController.reducePayment,
  );

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
    // MOTOR_DAILY_RATES imported at top level
    res.json(MOTOR_DAILY_RATES);
  });
  router.put(
    '/settings',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN),
    controllers.settingController.update,
  );

  // Saving
  router.get(
    '/savings/contract/:contractId',
    authMiddleware,
    controllers.savingController.getByContractId,
  );
  router.get(
    '/savings/contract/:contractId/balance',
    authMiddleware,
    controllers.savingController.getBalance,
  );
  router.post(
    '/savings/contract/:contractId/debit/service',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.savingController.debitForService,
  );
  router.post(
    '/savings/contract/:contractId/debit/transfer',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.savingController.debitForTransfer,
  );
  router.post(
    '/savings/contract/:contractId/claim',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.savingController.claimSaving,
  );
  router.post(
    '/savings/contract/:contractId/recalculate',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.savingController.recalculateBalance,
  );

  // Service Records (Compensation)
  router.post(
    '/service-records',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.serviceRecordController.create,
  );
  router.get(
    '/service-records/contract/:contractId',
    authMiddleware,
    controllers.serviceRecordController.getByContractId,
  );
  router.get('/service-records/:id', authMiddleware, controllers.serviceRecordController.getById);
  router.patch(
    '/service-records/:id/revoke',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
    controllers.serviceRecordController.revoke,
  );

  // Scheduler (Manual Trigger)
  router.post(
    '/scheduler/run-daily-tasks',
    authMiddleware,
    requireRole(UserRole.SUPER_ADMIN),
    async (_req, res, next) => {
      try {
        const result = await controllers.scheduler.runManual();
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/scheduler/status', authMiddleware, (_req, res) => {
    res.json(controllers.scheduler.getStatus());
  });

  return router;
}
