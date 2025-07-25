#!/usr/bin/env tsx

import 'dotenv/config';
import { initializeDatabase, query, closeDatabase } from './connection';
import { logger } from '../utils/logger';

/**
 * Clear all mock/seeded data from the database
 * This will remove the 30 days of fake historical data and keep only real AAVE data
 */
async function clearMockData() {
  try {
    logger.info('🧹 Starting mock data cleanup...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Clear all mock historical data
    logger.info('🗑️ Clearing historical mock data...');
    
    // Clear performance data (all mock)
    await query('DELETE FROM daily_performance');
    logger.info('Cleared daily performance records');
    
    // Clear chain rates (all mock historical data)
    await query('DELETE FROM chain_rates');
    logger.info('Cleared chain rate records');
    
    // Clear performance metrics cache (calculated from mock data)
    await query('DELETE FROM performance_metrics_cache');
    logger.info('Cleared cached performance metrics');
    
    // Clear rebalancing history (all mock)
    await query('DELETE FROM rebalancing_history');
    logger.info('Cleared rebalancing history records');
    
    // Clear vault data (all mock)
    await query('DELETE FROM vault_data');
    logger.info('Cleared vault data records');
    
    // Clear old AAVE pool data (keep only recent real data)
    // Delete data older than 1 hour to keep any real data that was just collected
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await query('DELETE FROM aave_pool_data WHERE created_at < $1', [oneHourAgo]);
    logger.info('Cleared old AAVE pool data records');
    
    // Clear baseline configuration (keep structure but remove mock allocations)
    await query('DELETE FROM baseline_configuration');
    logger.info('Cleared baseline configuration records');
    
    // Insert realistic baseline configuration for current use
    logger.info('📊 Setting up realistic baseline allocation...');
    await query(`
      INSERT INTO baseline_configuration 
      (chain_name, initial_allocation, percentage_allocation, effective_from) 
      VALUES 
      ('ethereum', 0.00, 40.00, CURRENT_DATE),
      ('base', 0.00, 30.00, CURRENT_DATE),
      ('optimism', 0.00, 15.00, CURRENT_DATE),
      ('arbitrum', 0.00, 10.00, CURRENT_DATE),
      ('polygon', 0.00, 5.00, CURRENT_DATE)
    `);
    
    logger.info('✅ Mock data cleanup completed successfully');
    logger.info('🔄 Backend will now collect only real AAVE data going forward');
    logger.info('📈 Performance charts will show real data as it accumulates');
    
  } catch (error) {
    logger.error('❌ Mock data cleanup failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  clearMockData();
}

export { clearMockData }; 