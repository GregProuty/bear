#!/usr/bin/env tsx

import 'dotenv/config';
import { initializeDatabase, query, closeDatabase } from './connection';
import { logger } from '../utils/logger';

async function seed() {
  try {
    logger.info('🌱 Starting database seeding...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Clear existing data for fresh seed
    logger.info('🧹 Clearing existing data...');
    await query('DELETE FROM performance_metrics_cache');
    await query('DELETE FROM rebalancing_history');
    await query('DELETE FROM vault_data');
    await query('DELETE FROM aave_pool_data');
    await query('DELETE FROM chain_rates');
    await query('DELETE FROM daily_performance');
    await query('DELETE FROM baseline_configuration');
    
    // Insert baseline configuration
    logger.info('📊 Inserting baseline configuration...');
    await query(`
      INSERT INTO baseline_configuration 
      (chain_name, initial_allocation, percentage_allocation, effective_from) 
      VALUES 
      ('ethereum', 2500000.00, 50.00, '2024-12-01'),
      ('base', 1000000.00, 20.00, '2024-12-01'),
      ('optimism', 750000.00, 15.00, '2024-12-01'),
      ('arbitrum', 500000.00, 10.00, '2024-12-01'),
      ('polygon', 250000.00, 5.00, '2024-12-01')
    `);
    
    // Generate 30 days of historical data
    logger.info('📈 Generating historical performance data...');
    
    const totalFund = 5000000; // $5M total fund
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Generate realistic APY rates with some volatility
      const baseRates = {
        ethereum: 4.2 + (Math.random() - 0.5) * 0.8, // 3.8% - 4.6%
        base: 3.8 + (Math.random() - 0.5) * 1.0,     // 3.3% - 4.3%
        optimism: 4.5 + (Math.random() - 0.5) * 0.6, // 4.2% - 4.8%
        arbitrum: 4.0 + (Math.random() - 0.5) * 0.7, // 3.65% - 4.35%
        polygon: 5.2 + (Math.random() - 0.5) * 1.2   // 4.6% - 5.8%
      };
      
      // Optimized rates are higher due to rebalancing
      const optimizedRates = {
        ethereum: baseRates.ethereum + 0.3 + Math.random() * 0.4,
        base: baseRates.base + 0.5 + Math.random() * 0.6,
        optimism: baseRates.optimism + 0.2 + Math.random() * 0.3,
        arbitrum: baseRates.arbitrum + 0.4 + Math.random() * 0.5,
        polygon: baseRates.polygon + 0.3 + Math.random() * 0.4
      };
      
      // Baseline allocations (static)
      const baselineAllocations = {
        ethereum: 2500000,
        base: 1000000,
        optimism: 750000,
        arbitrum: 500000,
        polygon: 250000
      };
      
      // Optimized allocations (agent rebalances for better rates)
      const optimizedAllocations = {
        ethereum: baselineAllocations.ethereum + (Math.random() - 0.5) * 500000,
        base: baselineAllocations.base + (Math.random() - 0.5) * 300000,
        optimism: baselineAllocations.optimism + (Math.random() - 0.5) * 400000,
        arbitrum: baselineAllocations.arbitrum + (Math.random() - 0.5) * 200000,
        polygon: baselineAllocations.polygon + (Math.random() - 0.5) * 150000
      };
      
      // Normalize optimized allocations to total fund
      const optimizedSum = Object.values(optimizedAllocations).reduce((a, b) => a + b, 0);
      const scaleFactor = totalFund / optimizedSum;
      (Object.keys(optimizedAllocations) as Array<keyof typeof optimizedAllocations>).forEach(key => {
        optimizedAllocations[key] *= scaleFactor;
      });
      
      // Insert chain rates for each chain
      for (const [chainName, baselineAllocation] of Object.entries(baselineAllocations) as Array<[keyof typeof baselineAllocations, number]>) {
        await query(`
          INSERT INTO chain_rates 
          (date, chain_name, apy_baseline, apy_optimized, allocation_baseline, allocation_optimized, utilization_ratio, total_supply, elasticity_factor)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          dateStr,
          chainName,
          baseRates[chainName].toFixed(4),
          optimizedRates[chainName].toFixed(4),
          baselineAllocation.toFixed(2),
          optimizedAllocations[chainName].toFixed(2),
          (0.60 + Math.random() * 0.30).toFixed(4), // 60-90% utilization
          (1000000000 + Math.random() * 500000000).toFixed(2), // $1B-1.5B total supply
          (0.01 + Math.random() * 0.02).toFixed(6) // 0.01-0.03 elasticity
        ]);
        
        // Insert AAVE pool data
        const totalLiquidity = 1000000000 + Math.random() * 500000000;
        const utilizationRate = 0.60 + Math.random() * 0.30;
        const totalBorrowed = totalLiquidity * utilizationRate;
        
        await query(`
          INSERT INTO aave_pool_data
          (chain_name, pool_address, total_liquidity, total_borrowed, utilization_rate, supply_apy, variable_borrow_apy, stable_borrow_apy, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          chainName,
          `0x${Math.random().toString(16).substr(2, 40)}`, // Random address
          totalLiquidity.toFixed(2),
          totalBorrowed.toFixed(2),
          utilizationRate.toFixed(4),
          baseRates[chainName].toFixed(4),
          (baseRates[chainName] + 2.0 + Math.random()).toFixed(4),
          (baseRates[chainName] + 1.5 + Math.random() * 0.5).toFixed(4),
          currentDate.toISOString()
        ]);
        
        // Insert vault data
        await query(`
          INSERT INTO vault_data
          (chain_name, vault_address, total_assets, total_shares, amount_invested, share_price, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          chainName,
          `0x${Math.random().toString(16).substr(2, 40)}`, // Random address
          optimizedAllocations[chainName].toFixed(2),
          (optimizedAllocations[chainName] * 0.95).toFixed(2), // 95% of assets as shares
          optimizedAllocations[chainName].toFixed(2),
          (1.0 + Math.random() * 0.1).toFixed(8), // Share price 1.0-1.1
          currentDate.toISOString()
        ]);
      }
      
      // Calculate daily performance
      let baselineTotal = 0;
      let optimizedTotal = 0;
      
      for (const [chainName, allocation] of Object.entries(baselineAllocations) as Array<[keyof typeof baselineAllocations, number]>) {
        const dailyReturn = baseRates[chainName] / 365 / 100; // Daily return
        baselineTotal += allocation * (1 + dailyReturn);
      }
      
      for (const [chainName, allocation] of Object.entries(optimizedAllocations) as Array<[keyof typeof optimizedAllocations, number]>) {
        const dailyReturn = optimizedRates[chainName] / 365 / 100; // Daily return
        optimizedTotal += allocation * (1 + dailyReturn);
      }
      
      const differential = optimizedTotal - baselineTotal;
      const differentialPercentage = (differential / baselineTotal) * 100;
      
      // Insert daily performance
      await query(`
        INSERT INTO daily_performance 
        (date, total_fund_allocation_baseline, total_fund_allocation_optimized, differential, differential_percentage)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        dateStr,
        baselineTotal.toFixed(2),
        optimizedTotal.toFixed(2),
        differential.toFixed(2),
        differentialPercentage.toFixed(4)
      ]);
    }
    
    // Generate some rebalancing history
    logger.info('🔄 Generating rebalancing history...');
    
    for (let i = 0; i < 8; i++) {
      const rebalanceDate = new Date(startDate);
      rebalanceDate.setDate(startDate.getDate() + (i * 3) + Math.floor(Math.random() * 3));
      
      const chains = ['ethereum', 'base', 'optimism', 'arbitrum', 'polygon'];
      const fromChain = chains[Math.floor(Math.random() * chains.length)];
      let toChain = chains[Math.floor(Math.random() * chains.length)];
      while (toChain === fromChain) {
        toChain = chains[Math.floor(Math.random() * chains.length)];
      }
      
      const amount = 100000 + Math.random() * 400000; // $100K - $500K
      const predictedGain = amount * 0.001 + Math.random() * amount * 0.005; // 0.1-0.6% gain
      const actualGain = predictedGain * (0.8 + Math.random() * 0.4); // 80-120% of predicted
      
      await query(`
        INSERT INTO rebalancing_history
        (date, from_chain, to_chain, amount, reason, predicted_gain, actual_gain, status, transaction_hash, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        rebalanceDate.toISOString().split('T')[0],
        fromChain,
        toChain,
        amount.toFixed(2),
        `Higher APY detected on ${toChain} (${(3 + Math.random() * 2).toFixed(2)}% vs ${(2 + Math.random() * 2).toFixed(2)}%)`,
        predictedGain.toFixed(2),
        actualGain.toFixed(2),
        'completed',
        `0x${Math.random().toString(16).substr(2, 64)}`,
        rebalanceDate.toISOString()
      ]);
    }
    
    // Generate performance metrics cache
    logger.info('📊 Calculating performance metrics...');
    
    const perfMetrics = await query(`
      SELECT 
        COUNT(*) as total_days,
        SUM(differential) as total_gain,
        AVG(differential) as avg_daily_gain,
        AVG(differential_percentage) as avg_daily_gain_pct,
        MAX(differential) as max_gain,
        MIN(differential) as min_gain,
        STDDEV(differential_percentage) as volatility
      FROM daily_performance
    `);
    
    const metrics = perfMetrics[0];
    const totalGain = parseFloat(metrics.total_gain);
    const totalGainPct = (totalGain / totalFund) * 100;
    const sharpeRatio = parseFloat(metrics.avg_daily_gain_pct) / parseFloat(metrics.volatility || 1);
    const maxDrawdown = Math.abs(parseFloat(metrics.min_gain)) / totalFund * 100;
    
    // Get best and worst performing chains
    const chainPerf = await query(`
      SELECT 
        chain_name,
        AVG(apy_optimized - apy_baseline) as avg_improvement
      FROM chain_rates 
      GROUP BY chain_name 
      ORDER BY avg_improvement DESC
    `);
    
    await query(`
      INSERT INTO performance_metrics_cache
      (calculation_date, total_gain, total_gain_percentage, average_daily_gain, average_daily_gain_percentage, 
       best_performing_chain, worst_performing_chain, total_days_tracked, sharpe_ratio, max_drawdown, volatility)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      new Date().toISOString().split('T')[0],
      totalGain.toFixed(2),
      totalGainPct.toFixed(4),
      parseFloat(metrics.avg_daily_gain).toFixed(2),
      parseFloat(metrics.avg_daily_gain_pct).toFixed(4),
      chainPerf[0]?.chain_name || 'polygon',
      chainPerf[chainPerf.length - 1]?.chain_name || 'ethereum',
      parseInt(metrics.total_days),
      sharpeRatio.toFixed(4),
      maxDrawdown.toFixed(4),
      parseFloat(metrics.volatility || 0).toFixed(4)
    ]);
    
    logger.info('✅ Database seeding completed successfully');
    logger.info(`📊 Generated data for ${metrics.total_days} days`);
    logger.info(`💰 Total simulated gain: $${totalGain.toFixed(2)} (${totalGainPct.toFixed(2)}%)`);
    
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seed();
}

export { seed }; 