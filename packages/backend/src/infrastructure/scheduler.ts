import { schedule, ScheduledTask } from 'node-cron';
import { PaymentService } from '../application/services/PaymentService';
import { ContractService } from '../application/services/ContractService';

export interface SchedulerStatus {
  isStarted: boolean;
  isJobRunning: boolean;
  lastRunAt: Date | null;
  lastRunResult: 'success' | 'error' | null;
}

/**
 * Scheduler that runs daily tasks using node-cron.
 * Executes at 00:01 every day (Asia/Jakarta timezone).
 * Also supports manual trigger via runManual() with concurrency lock.
 */
export class Scheduler {
  private task: ScheduledTask | null = null;
  private isStarted = false;
  private isJobRunning = false;
  private lastRunAt: Date | null = null;
  private lastRunResult: 'success' | 'error' | null = null;

  constructor(
    private paymentService: PaymentService,
    private contractService: ContractService,
  ) {}

  /**
   * Start the scheduler.
   * Runs daily tasks immediately on startup, then at 00:01 every day.
   */
  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;

    console.log('⏰ Scheduler started (cron: every day at 00:01 WIB)');

    // Run immediately on startup
    this.runDailyTasks().catch((err) => console.error('Scheduler initial run error:', err));

    // Schedule daily at 00:01 Asia/Jakarta
    this.task = schedule(
      '1 0 * * *',
      () => {
        this.runDailyTasks().catch((err) => console.error('Scheduler error:', err));
      },
      {
        timezone: 'Asia/Jakarta',
      },
    );
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.isStarted = false;
    console.log('⏰ Scheduler stopped');
  }

  /**
   * Get current scheduler status.
   */
  getStatus(): SchedulerStatus {
    return {
      isStarted: this.isStarted,
      isJobRunning: this.isJobRunning,
      lastRunAt: this.lastRunAt,
      lastRunResult: this.lastRunResult,
    };
  }

  /**
   * Manual trigger with concurrency lock.
   * Returns false if job is already running.
   */
  async runManual(): Promise<{ success: boolean; message: string }> {
    if (this.isJobRunning) {
      return { success: false, message: 'Job sedang berjalan, silakan tunggu.' };
    }

    await this.runDailyTasks();
    return { success: true, message: 'Daily tasks berhasil dijalankan.' };
  }

  /**
   * Run all daily tasks:
   * 1. Extend PaymentDay records
   * 2. Rollover expired payments
   * 3. Generate new daily payments
   * 4. Check and update overdue contracts
   */
  async runDailyTasks(): Promise<void> {
    if (this.isJobRunning) return; // Prevent concurrent execution
    this.isJobRunning = true;

    const now = new Date();
    console.log(`⏰ Running daily tasks at ${now.toISOString()}`);

    try {
      // 0. Extend PaymentDay records 30 days ahead
      await this.paymentService.extendPaymentDayRecords();

      // 1. Rollover expired payments from previous day(s)
      const rolledOver = await this.paymentService.rolloverExpiredPayments();
      if (rolledOver > 0) {
        console.log(`  📋 Rolled over ${rolledOver} expired payments`);
      }

      // 2. Generate new daily payments
      const generated = await this.paymentService.generateDailyPayments();
      console.log(`  📋 Generated ${generated} daily payments`);

      // 3. Check for overdue contracts
      const overdueCount = await this.contractService.checkAndUpdateOverdueContracts();
      if (overdueCount > 0) {
        console.log(`  ⚠️  Marked ${overdueCount} contracts as OVERDUE`);
      }

      this.lastRunAt = new Date();
      this.lastRunResult = 'success';
      console.log('⏰ Daily tasks completed');
    } catch (error) {
      this.lastRunAt = new Date();
      this.lastRunResult = 'error';
      console.error('⏰ Daily tasks failed:', error);
    } finally {
      this.isJobRunning = false;
    }
  }
}
