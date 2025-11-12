import { performanceService } from '../services/performanceService';
import { logger } from '../utils/logger';

/**
 * Performance calculation job that runs after data collection
 * This implements the daily performance calculation logic from the document
 */
export async function performanceCalculationJob(): Promise<void> {
  const startTime = Date.now();
  logger.info('🧮 Starting performance calculation job');

  try {
    // Calculate performance for today
    const today = new Date().toISOString().split('T')[0]!; // Non-null assertion since split always returns string
    const performanceData = await performanceService.calculateDailyPerformance(today);

    if (!performanceData) {
      logger.warn('⚠️ No performance data calculated - insufficient AAVE data');
      return;
    }

    // Update performance metrics cache
    await updatePerformanceMetricsCache();

    const duration = Date.now() - startTime;
    const differential = parseFloat(performanceData.differential);
    const differentialPct = performanceData.differentialPercentage || 0;
    
    logger.info(`✅ Performance calculation completed in ${duration}ms`);
    logger.info(`📊 Daily differential: $${differential.toFixed(2)} (${differentialPct.toFixed(4)}%)`);

    // Log chain-specific performance
    const chainSummary = performanceData.chains.map(chain => ({
      chain: chain.chainName,
      baseline: '$' + formatNumber(parseFloat(chain.allocationBaseline)),
      optimized: '$' + formatNumber(parseFloat(chain.allocationOptimized)),
      apyDiff: (chain.apyOptimized - chain.apyBaseline).toFixed(4) + '%'
    }));

    logger.info('⚖️ Chain performance:', chainSummary);

    // Alert if significant performance detected
    if (Math.abs(differential) > 1000) { // Alert for > $1000 differential
      logger.warn(`🚨 Significant performance differential detected: $${differential.toFixed(2)}`);
    }

  } catch (error) {
    logger.error('❌ Performance calculation job failed:', error);
    throw error;
  }
}

/**
 * Update the performance metrics cache for faster queries
 */
async function updatePerformanceMetricsCache(): Promise<void> {
  try {
    const { query } = await import('../database/connection');
    const today = new Date().toISOString().split('T')[0];

    // Calculate current metrics
    const metricsResult = await query(`
      SELECT 
        COUNT(*) as total_days_tracked,
        SUM(differential) as total_gain,
        AVG(differential) as average_daily_gain,
        SUM(differential) / NULLIF(SUM(total_fund_allocation_baseline), 0) * 100 as total_gain_percentage,
        AVG(differential) / NULLIF(AVG(total_fund_allocation_baseline), 0) * 100 as average_daily_gain_percentage,
        STDDEV(differential) as volatility
      FROM daily_performance
      WHERE date >= $1 - INTERVAL '1 year'
    `, [today]);

    const metrics = metricsResult[0];

    // Get best and worst performing chains
    const chainMetricsResult = await query(`
      SELECT 
        chain_name,
        AVG(apy_optimized - apy_baseline) as avg_improvement
      FROM chain_rates
      WHERE date >= $1 - INTERVAL '30 days'
      GROUP BY chain_name
      ORDER BY avg_improvement DESC
    `, [today]);

    const bestChain = chainMetricsResult[0]?.chain_name || null;
    const worstChain = chainMetricsResult[chainMetricsResult.length - 1]?.chain_name || null;

    // Calculate Sharpe ratio (simplified)
    const volatility = parseFloat(metrics.volatility) || 0;
    const averageReturn = parseFloat(metrics.average_daily_gain_percentage) || 0;
    const riskFreeRate = 0.05; // 5% annual risk-free rate
    const dailyRiskFreeRate = riskFreeRate / 365;
    
    const sharpeRatio = volatility > 0 
      ? (averageReturn - dailyRiskFreeRate) / volatility 
      : 0;

    // Update/insert cache
    await query(`
      INSERT INTO performance_metrics_cache 
      (calculation_date, total_gain, total_gain_percentage, average_daily_gain, 
       average_daily_gain_percentage, best_performing_chain, worst_performing_chain, 
       total_days_tracked, sharpe_ratio, volatility)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (calculation_date) DO UPDATE SET
        total_gain = EXCLUDED.total_gain,
        total_gain_percentage = EXCLUDED.total_gain_percentage,
        average_daily_gain = EXCLUDED.average_daily_gain,
        average_daily_gain_percentage = EXCLUDED.average_daily_gain_percentage,
        best_performing_chain = EXCLUDED.best_performing_chain,
        worst_performing_chain = EXCLUDED.worst_performing_chain,
        total_days_tracked = EXCLUDED.total_days_tracked,
        sharpe_ratio = EXCLUDED.sharpe_ratio,
        volatility = EXCLUDED.volatility
    `, [
      today,
      metrics.total_gain || 0,
      metrics.total_gain_percentage || 0,
      metrics.average_daily_gain || 0,
      metrics.average_daily_gain_percentage || 0,
      bestChain,
      worstChain,
      metrics.total_days_tracked || 0,
      sharpeRatio,
      volatility
    ]);

    logger.debug('📊 Performance metrics cache updated');

  } catch (error) {
    logger.error('Failed to update performance metrics cache:', error);
    // Don't throw - this is not critical to the main job
  }
}

/**
 * Format large numbers for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(0);
} 