import { BillingService } from '../application/services/BillingService';
import { ContractService } from '../application/services/ContractService';

/**
 * Simple scheduler that runs daily tasks.
 * Uses setInterval instead of node-cron to avoid extra dependency.
 */
export class Scheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    private billingService: BillingService,
    private contractService: ContractService,
  ) {}

  /**
   * Start the scheduler. Runs daily tasks immediately, then every 24 hours.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('⏰ Scheduler started');

    // Run immediately on startup
    this.runDailyTasks().catch(err => console.error('Scheduler initial run error:', err));

    // Run every 24 hours
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.runDailyTasks().catch(err => console.error('Scheduler error:', err));
    }, TWENTY_FOUR_HOURS);
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
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
