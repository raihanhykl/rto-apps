import { schedule, ScheduledTask } from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { PaymentService } from '../application/services/PaymentService';
import { ContractService } from '../application/services/ContractService';

export interface SchedulerStatus {
  isStarted: boolean;
  isJobRunning: boolean;
  lastRunAt: Date | null;
  lastRunResult: 'success' | 'error' | null;
}

// Advisory lock ID for daily tasks — arbitrary constant
const DAILY_TASKS_LOCK_ID = 100001;

/**
 * Scheduler that runs daily tasks using node-cron.
 * Executes at 00:01 every day (Asia/Jakarta timezone).
 * Also supports manual trigger via runManual() with concurrency lock.
 *
 * When running with PostgreSQL (prismaClient provided), uses advisory locks
 * to prevent multiple instances from running daily tasks simultaneously.
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
    private prismaClient: PrismaClient | null = null,
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
   * Acquire PostgreSQL advisory lock (non-blocking).
   * Returns true if lock acquired, false if another instance holds it.
   * In InMemory mode (no prismaClient), always returns true.
   */
  private async acquireAdvisoryLock(): Promise<boolean> {
    if (!this.prismaClient) return true;

    try {
      const result = await this.prismaClient.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_lock(${DAILY_TASKS_LOCK_ID}) as locked
      `;
      return result[0]?.locked ?? false;
    } catch (error) {
      console.error('Failed to acquire advisory lock:', error);
      return false;
    }
  }

  /**
   * Release PostgreSQL advisory lock.
   */
  private async releaseAdvisoryLock(): Promise<void> {
    if (!this.prismaClient) return;

    try {
      await this.prismaClient.$queryRaw`
        SELECT pg_advisory_unlock(${DAILY_TASKS_LOCK_ID})
      `;
    } catch (error) {
      console.error('Failed to release advisory lock:', error);
    }
  }

  /**
   * Run all daily tasks:
   * 1. Extend PaymentDay records
   * 2. Rollover expired payments
   * 3. Generate new daily payments
   * 4. Check and update overdue contracts
   *
   * Uses PostgreSQL advisory lock when available to prevent
   * concurrent execution across multiple instances.
   */
  async runDailyTasks(): Promise<void> {
    if (this.isJobRunning) return; // Prevent concurrent execution (same instance)

    // Acquire distributed lock (multi-instance)
    const lockAcquired = await this.acquireAdvisoryLock();
    if (!lockAcquired) {
      console.log('⏰ Another instance is running daily tasks, skipping');
      return;
    }

    this.isJobRunning = true;

    try {
      const now = new Date();
      console.log(`⏰ Running daily tasks at ${now.toISOString()}`);
      const errors: Array<{ step: string; error: unknown }> = [];

      // 0. Extend PaymentDay records 30 days ahead
      try {
        await this.paymentService.extendPaymentDayRecords();
      } catch (error) {
        console.error('Scheduler: extendPaymentDayRecords failed:', error);
        errors.push({ step: 'extendPaymentDayRecords', error });
      }

      // 1. Rollover expired payments from previous day(s)
      try {
        const rolledOver = await this.paymentService.rolloverExpiredPayments();
        if (rolledOver > 0) {
          console.log(`  📋 Rolled over ${rolledOver} expired payments`);
        }
      } catch (error) {
        console.error('Scheduler: rolloverExpiredPayments failed:', error);
        errors.push({ step: 'rolloverExpiredPayments', error });
      }

      // 2. Generate new daily payments
      try {
        const generated = await this.paymentService.generateDailyPayments();
        console.log(`  📋 Generated ${generated} daily payments`);
      } catch (error) {
        console.error('Scheduler: generateDailyPayments failed:', error);
        errors.push({ step: 'generateDailyPayments', error });
      }

      // 3. Check for overdue contracts
      try {
        const overdueCount = await this.contractService.checkAndUpdateOverdueContracts();
        if (overdueCount > 0) {
          console.log(`  ⚠️  Marked ${overdueCount} contracts as OVERDUE`);
        }
      } catch (error) {
        console.error('Scheduler: checkAndUpdateOverdueContracts failed:', error);
        errors.push({ step: 'checkAndUpdateOverdueContracts', error });
      }

      this.lastRunAt = new Date();
      this.lastRunResult = errors.length > 0 ? 'error' : 'success';

      if (errors.length > 0) {
        console.error(
          `⏰ Daily tasks completed with ${errors.length} error(s):`,
          errors.map((e) => e.step),
        );
      } else {
        console.log('⏰ Daily tasks completed successfully');
      }
    } finally {
      this.isJobRunning = false;
      await this.releaseAdvisoryLock();
    }
  }
}
