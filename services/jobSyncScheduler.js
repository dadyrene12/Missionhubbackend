const cron = require('node-cron');
const aggregatorService = require('./jobAggregatorService');

class JobSyncScheduler {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
  }

  async runSync() {
    if (this.isRunning) {
      console.log('[JobSync] Already running, skipping...');
      return { success: false, skipped: true };
    }

    this.isRunning = true;
    console.log('[JobSync] Starting external jobs sync...');
    const startedAt = Date.now();

    try {
      const results = await aggregatorService.syncAll();
      this.lastRunTime = new Date();
      const ok = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      console.log(
        `[JobSync] Completed in ${Date.now() - startedAt}ms: ` +
        `sources=${results.length} ok=${ok.length} failed=${failed.length} ` +
        `created=${ok.reduce((s, r) => s + (r.created || 0), 0)} ` +
        `updated=${ok.reduce((s, r) => s + (r.updated || 0), 0)}`
      );
      failed.forEach(r => console.error(`[JobSync] Source ${r.sourceKey} failed: ${r.error}`));

      return { success: true, results, duration: Date.now() - startedAt };
    } catch (error) {
      console.error('[JobSync] Error during sync:', error);
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    console.log('[JobSync] Initializing scheduler...');

    this.runSync().catch(console.error);

    cron.schedule('0 */6 * * *', async () => {
      console.log('[JobSync] Running scheduled external jobs sync (every 6 hours)...');
      await this.runSync();
    });

    console.log('[JobSync] Scheduler started successfully');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime
    };
  }
}

module.exports = new JobSyncScheduler();
