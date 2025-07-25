import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { aaveDataService } from '../services/aaveDataService';
import { performanceService } from '../services/performanceService';
import { dataCollectionJob } from './dataCollectionJob';
import { performanceCalculationJob } from './performanceCalculationJob';

// Track running jobs to prevent overlaps
const runningJobs = new Set<string>();

export function startCronJobs(): void {
  logger.info('🕐 Starting cron jobs...');

  // Data collection job - runs daily at 11am PST (7pm UTC)
  const dataCollectionSchedule = process.env.DATA_COLLECTION_SCHEDULE || '0 19 * * *';
  cron.schedule(dataCollectionSchedule, async () => {
    const jobId = 'data-collection';
    
    if (runningJobs.has(jobId)) {
      logger.warn(`⏰ Skipping ${jobId} - already running`);
      return;
    }

    try {
      runningJobs.add(jobId);
      logger.info(`🔄 Starting ${jobId} job`);
      await dataCollectionJob();
      logger.info(`✅ Completed ${jobId} job`);
    } catch (error) {
      logger.error(`❌ Error in ${jobId} job:`, error);
    } finally {
      runningJobs.delete(jobId);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Performance calculation job - runs daily at 11:05am PST (7:05pm UTC)
  const performanceCalculationSchedule = process.env.PERFORMANCE_CALCULATION_SCHEDULE || '5 19 * * *';
  cron.schedule(performanceCalculationSchedule, async () => {
    const jobId = 'performance-calculation';
    
    if (runningJobs.has(jobId)) {
      logger.warn(`⏰ Skipping ${jobId} - already running`);
      return;
    }

    try {
      runningJobs.add(jobId);
      logger.info(`🔄 Starting ${jobId} job`);
      await performanceCalculationJob();
      logger.info(`✅ Completed ${jobId} job`);
    } catch (error) {
      logger.error(`❌ Error in ${jobId} job:`, error);
    } finally {
      runningJobs.delete(jobId);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Daily cleanup job - disabled for now until cleanupOldData method is implemented
  // cron.schedule('0 2 * * *', async () => {
  //   const jobId = 'daily-cleanup';
  //   
  //   if (runningJobs.has(jobId)) {
  //     logger.warn(`⏰ Skipping ${jobId} - already running`);
  //     return;
  //   }

  //   try {
  //     runningJobs.add(jobId);
  //     logger.info(`🔄 Starting ${jobId} job`);
  //     await performanceService.cleanupOldData();
  //     logger.info(`✅ Completed ${jobId} job`);
  //   } catch (error) {
  //     logger.error(`❌ Error in ${jobId} job:`, error);
  //   } finally {
  //     runningJobs.delete(jobId);
  //   }
  // }, {
  //   scheduled: true,
  //   timezone: 'UTC'
  // });

  logger.info(`📅 Cron jobs scheduled:`);
  logger.info(`  - Data collection: ${dataCollectionSchedule} (11am PST daily)`);
  logger.info(`  - Performance calculation: ${performanceCalculationSchedule} (11:05am PST daily)`);
  logger.info(`  - Daily cleanup: disabled`);
}

// Manual job execution functions for testing
export async function runDataCollectionManually(): Promise<void> {
  logger.info('🔧 Running data collection job manually');
  await dataCollectionJob();
}

export async function runPerformanceCalculationManually(): Promise<void> {
  logger.info('🔧 Running performance calculation job manually');
  await performanceCalculationJob();
}

// Health check for cron jobs
export function getCronStatus(): { scheduled: number; running: number; lastErrors: string[] } {
  return {
    scheduled: cron.getTasks().size,
    running: runningJobs.size,
    lastErrors: [] // Could be extended to track recent errors
  };
} 