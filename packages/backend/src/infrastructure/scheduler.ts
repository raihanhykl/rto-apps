import { schedule, ScheduledTask } from 'node-cron';
import { BillingService } from '../application/services/BillingService';
import { ContractService } from '../application/services/ContractService';

/**
 * Scheduler that runs daily tasks using node-cron.
 * Executes at 00:01 every day (Asia/Jakarta timezone).
 */
export class Scheduler {
  private task: ScheduledTask | null = null;
  private isRunning = false;

  constructor(
    private billingService: BillingService,
    private contractService: ContractService,
  ) {}

  /**
   * Start the scheduler.
   * Runs daily tasks immediately on startup, then at 00:01 every day.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('⏰ Scheduler started (cron: every day at 00:01 WIB)');

    // Run immediately on startup
    this.runDailyTasks().catch(err => console.error('Scheduler initial run error:', err));

    // Schedule daily at 00:01 Asia/Jakarta
    this.task = schedule('1 0 * * *', () => {
      this.runDailyTasks().catch(err => console.error('Scheduler error:', err));
    }, {
      timezone: 'Asia/Jakarta',
    });
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.isRunning = false;
    console.log('⏰ Scheduler stopped');
  }

  /**
   * Run all daily tasks:
   * 1. Rollover expired billings
   * 2. Generate new daily billings
   * 3. Check and update overdue contracts
   */
  async runDailyTasks(): Promise<void> {
    const now = new Date();
    console.log(`⏰ Running daily tasks at ${now.toISOString()}`);

    try {
      // 1. Rollover expired billings from previous day(s)
      const rolledOver = await this.billingService.rolloverExpiredBillings();
      if (rolledOver > 0) {
        console.log(`  📋 Rolled over ${rolledOver} expired billings`);
      }

      // 2. Generate new daily billings
      const generated = await this.billingService.generateDailyBilling();
      console.log(`  📋 Generated ${generated} daily billings`);

      // 3. Check for overdue contracts
      const overdueCount = await this.contractService.checkAndUpdateOverdueContracts();
      if (overdueCount > 0) {
        console.log(`  ⚠️  Marked ${overdueCount} contracts as OVERDUE`);
      }

      console.log('⏰ Daily tasks completed');
    } catch (error) {
      console.error('⏰ Daily tasks failed:', error);
    }
  }
}
