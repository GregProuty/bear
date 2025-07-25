import { query, transaction } from '../database/connection';
import { logger } from '../utils/logger';
import { aaveDataService } from './aaveDataService';

export interface DailyPerformanceData {
  id: string;
  date: string;
  totalFundAllocationBaseline: string;
  totalFundAllocationOptimized: string;
  differential: string;
  differentialPercentage: number;
  // New fields for fund flow tracking
  totalInflows: string;
  totalOutflows: string;
  netFlow: string;
  previousDayTotal: string | null;
  chains: ChainPerformanceData[];
  createdAt: Date;
}

export interface ChainPerformanceData {
  chainName: string;
  apyBaseline: number;
  apyOptimized: number;
  allocationBaseline: string;
  allocationOptimized: string;
  utilizationRatio: number;
  totalSupply: string;
}

export interface PerformanceMetrics {
  totalGain: string;
  totalGainPercentage: number;
  averageDailyGain: string;
  averageDailyGainPercentage: number;
  bestPerformingChain: string;
  worstPerformingChain: string;
  rebalanceCount: number;
  totalDaysTracked: number;
  volatility: number;
  // New fund flow metrics
  totalInflows: string;
  totalOutflows: string;
  netFlow: string;
}

export interface FundFlow {
  id: string;
  date: string;
  chainName: string;
  flowType: 'deposit' | 'withdrawal';
  amount: string;
  userAddress?: string;
  transactionHash?: string;
  blockNumber?: number;
}

export class PerformanceService {
  private readonly TOTAL_FUND_SIZE = 5000000; // $5M as per document
  private readonly BASELINE_ALLOCATION = {
    ethereum: 4000000, // $4M (80%)
    base: 1000000      // $1M (20%)
  };

  /**
   * Calculate and store daily performance data using the new formula from the meeting
   * Formula: (Total funds today - inflows + outflows) / Previous day total fund
   */
  async calculateDailyPerformance(date: string): Promise<DailyPerformanceData | null> {
    try {
      logger.info(`🧮 Calculating performance for ${date} using new formula`);

      // Get current AAVE data for all chains
      const utilizationData = await aaveDataService.getUtilizationData();
      
      if (utilizationData.length === 0) {
        logger.warn('No utilization data available for performance calculation');
        return null;
      }

      // Get baseline allocation configuration
      const baselineConfig = await this.getBaselineAllocation(date);
      
      // Get fund flows for the day
      const fundFlows = await this.getFundFlows(date);
      
      // Get previous day's total for the new formula
      const previousDayTotal = await this.getPreviousDayTotal(date);
      
      // Calculate baseline scenario (no rebalancing)
      const baselinePerformance = await this.calculateBaselinePerformance(
        date, 
        utilizationData, 
        baselineConfig
      );

      // Calculate optimized scenario (with rebalancing)
      const optimizedPerformance = await this.calculateOptimizedPerformanceWithFlows(
        date,
        utilizationData,
        baselineConfig,
        fundFlows,
        previousDayTotal
      );

      // Apply the new performance formula
      const adjustedOptimizedValue = this.applyNewPerformanceFormula(
        optimizedPerformance.totalValue,
        fundFlows,
        previousDayTotal
      );

      // Calculate the differential
      const differential = adjustedOptimizedValue - baselinePerformance.totalValue;
      const differentialPercentage = baselinePerformance.totalValue > 0 
        ? (differential / baselinePerformance.totalValue) * 100 
        : 0;

      // Prepare chain performance data
      const chainPerformanceData: ChainPerformanceData[] = [];
      
      // Merge baseline and optimized data by chain
      for (const baselineChain of baselinePerformance.chains) {
        const optimizedChain = optimizedPerformance.chains.find(
          c => c.chainName === baselineChain.chainName
        );
        
        if (optimizedChain) {
          chainPerformanceData.push({
            chainName: baselineChain.chainName,
            apyBaseline: baselineChain.apy,
            apyOptimized: optimizedChain.apy,
            allocationBaseline: baselineChain.allocation.toString(),
            allocationOptimized: optimizedChain.allocation.toString(),
            utilizationRatio: baselineChain.utilizationRatio,
            totalSupply: baselineChain.totalSupply.toString()
          });
        }
      }

      // Calculate fund flow totals
      const totalInflows = fundFlows
        .filter(f => f.flowType === 'deposit')
        .reduce((sum, f) => sum + parseFloat(f.amount), 0);
      
      const totalOutflows = fundFlows
        .filter(f => f.flowType === 'withdrawal')
        .reduce((sum, f) => sum + parseFloat(f.amount), 0);
      
      const netFlow = totalInflows - totalOutflows;

      // Store the results
      const result = await this.storeDailyPerformance({
        date,
        totalFundAllocationBaseline: baselinePerformance.totalValue.toString(),
        totalFundAllocationOptimized: adjustedOptimizedValue.toString(),
        differential: differential.toString(),
        differentialPercentage,
        totalInflows: totalInflows.toString(),
        totalOutflows: totalOutflows.toString(),
        netFlow: netFlow.toString(),
        previousDayTotal: previousDayTotal?.toString() || null,
        chains: chainPerformanceData
      });

      logger.info(`✅ Performance calculated successfully for ${date}:`, {
        baseline: baselinePerformance.totalValue.toFixed(2),
        optimized: adjustedOptimizedValue.toFixed(2),
        differential: differential.toFixed(2),
        differentialPercentage: differentialPercentage.toFixed(4),
        inflows: totalInflows.toFixed(2),
        outflows: totalOutflows.toFixed(2),
        netFlow: netFlow.toFixed(2)
      });

      return result;

    } catch (error) {
      logger.error(`Error calculating daily performance for ${date}:`, error);
      throw error;
    }
  }

  /**
   * Apply the new performance formula from the meeting:
   * (Total funds today - inflows + outflows) / Previous day total fund
   */
  private applyNewPerformanceFormula(
    currentTotal: number,
    fundFlows: FundFlow[],
    previousDayTotal: number | null
  ): number {
    if (!previousDayTotal || previousDayTotal === 0) {
      logger.warn('No previous day total available, using current total');
      return currentTotal;
    }

    const totalInflows = fundFlows
      .filter(f => f.flowType === 'deposit')
      .reduce((sum, f) => sum + parseFloat(f.amount), 0);
    
    const totalOutflows = fundFlows
      .filter(f => f.flowType === 'withdrawal')
      .reduce((sum, f) => sum + parseFloat(f.amount), 0);

    // Apply the formula: (Total funds today - inflows + outflows) / Previous day total
    const adjustedTotal = (currentTotal - totalInflows + totalOutflows);
    const performanceMultiplier = adjustedTotal / previousDayTotal;
    
    logger.info('Applied new performance formula:', {
      currentTotal: currentTotal.toFixed(2),
      inflows: totalInflows.toFixed(2),
      outflows: totalOutflows.toFixed(2),
      previousDayTotal: previousDayTotal.toFixed(2),
      adjustedTotal: adjustedTotal.toFixed(2),
      performanceMultiplier: performanceMultiplier.toFixed(6)
    });

    // Return the performance-adjusted value
    return adjustedTotal;
  }

  /**
   * Get fund flows for a specific date
   */
  async getFundFlows(date: string): Promise<FundFlow[]> {
    try {
      const results = await query(`
        SELECT id, date, chain_name, flow_type, amount, user_address, transaction_hash, block_number
        FROM fund_flows
        WHERE date = $1
        ORDER BY created_at
      `, [date]);

      return results.map(row => ({
        id: row.id.toString(),
        date: row.date,
        chainName: row.chain_name,
        flowType: row.flow_type,
        amount: row.amount.toString(),
        userAddress: row.user_address,
        transactionHash: row.transaction_hash,
        blockNumber: row.block_number
      }));
    } catch (error) {
      logger.error(`Error fetching fund flows for ${date}:`, error);
      return [];
    }
  }

  /**
   * Add a fund flow record (will be called when contract data is available)
   */
  async addFundFlow(flowData: {
    date: string;
    chainName: string;
    flowType: 'deposit' | 'withdrawal';
    amount: string;
    userAddress?: string;
    transactionHash?: string;
    blockNumber?: number;
  }): Promise<void> {
    try {
      await query(`
        INSERT INTO fund_flows (date, chain_name, flow_type, amount, user_address, transaction_hash, block_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (date, chain_name, transaction_hash) DO NOTHING
      `, [
        flowData.date,
        flowData.chainName,
        flowData.flowType,
        flowData.amount,
        flowData.userAddress || null,
        flowData.transactionHash || null,
        flowData.blockNumber || null
      ]);

      logger.info(`Added fund flow: ${flowData.flowType} ${flowData.amount} on ${flowData.chainName}`);
    } catch (error) {
      logger.error('Error adding fund flow:', error);
      throw error;
    }
  }

  /**
   * Get previous day's total fund value
   */
  private async getPreviousDayTotal(currentDate: string): Promise<number | null> {
    try {
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousDateStr = previousDate.toISOString().split('T')[0];

      const result = await query(`
        SELECT total_fund_allocation_optimized
        FROM daily_performance
        WHERE date = $1
      `, [previousDateStr]);

      if (result.length > 0) {
        return parseFloat(result[0].total_fund_allocation_optimized);
      }

      return null;
    } catch (error) {
      logger.error('Error fetching previous day total:', error);
      return null;
    }
  }

  /**
   * Calculate optimized performance including fund flows
   */
  private async calculateOptimizedPerformanceWithFlows(
    date: string,
    utilizationData: any[],
    baselineConfig: any,
    fundFlows: FundFlow[],
    previousDayTotal: number | null
  ) {
    // Start with baseline allocation
    let totalOptimizedValue = 0;
    const optimizedChains: Array<{
      chainName: string;
      allocation: number;
      apy: number;
      utilizationRatio: number;
      totalSupply: number;
    }> = [];

    for (const [chainName, baselineAmount] of Object.entries(this.BASELINE_ALLOCATION) as Array<[string, number]>) {
      const chainData = utilizationData.find(d => d.chainName === chainName);
      
      if (chainData) {
        // Apply rebalancing optimization (simplified)
        const optimizationFactor = this.calculateOptimizationFactor(chainData);
        const optimizedAllocation = baselineAmount * optimizationFactor;
        
        // Calculate return for the day
        const dailyReturn = chainData.supplyAPY / 365 / 100;
        const chainValue = optimizedAllocation * (1 + dailyReturn);
        
        totalOptimizedValue += chainValue;
        
        optimizedChains.push({
          chainName,
          allocation: optimizedAllocation,
          apy: chainData.supplyAPY,
          utilizationRatio: chainData.utilizationRate,
          totalSupply: parseFloat(chainData.totalLiquidity || '0')
        });
      }
    }

    return {
      totalValue: totalOptimizedValue,
      chains: optimizedChains
    };
  }

  /**
   * Calculate baseline performance (existing logic)
   */
  private async calculateBaselinePerformance(
    date: string,
    utilizationData: any[],
    baselineConfig: any
  ) {
    let totalBaselineValue = 0;
    const baselineChains: Array<{
      chainName: string;
      allocation: number;
      apy: number;
      utilizationRatio: number;
      totalSupply: number;
    }> = [];

    for (const [chainName, baselineAmount] of Object.entries(this.BASELINE_ALLOCATION) as Array<[string, number]>) {
      const chainData = utilizationData.find(d => d.chainName === chainName);
      
      if (chainData) {
        // No optimization, just baseline allocation
        const dailyReturn = chainData.supplyAPY / 365 / 100;
        const chainValue = baselineAmount * (1 + dailyReturn);
        
        totalBaselineValue += chainValue;
        
        baselineChains.push({
          chainName,
          allocation: baselineAmount,
          apy: chainData.supplyAPY,
          utilizationRatio: chainData.utilizationRate,
          totalSupply: parseFloat(chainData.totalLiquidity || '0')
        });
      }
    }

    return {
      totalValue: totalBaselineValue,
      chains: baselineChains
    };
  }

  /**
   * Calculate optimization factor based on chain performance
   */
  private calculateOptimizationFactor(chainData: any): number {
    // Simplified optimization: prefer chains with higher APY and good utilization
    const apyScore = Math.min(chainData.supplyAPY / 5, 1); // Normalize to 0-1
    const utilizationScore = Math.min(chainData.utilizationRate / 0.8, 1); // Optimal around 80%
    
    return 0.8 + (apyScore * utilizationScore) * 0.4; // Range: 0.8 to 1.2
  }

  /**
   * Get baseline allocation configuration
   */
  private async getBaselineAllocation(date: string): Promise<Record<string, number>> {
    const results = await query(`
      SELECT chain_name, initial_allocation
      FROM baseline_configuration
      WHERE effective_from <= $1 
      AND (effective_to IS NULL OR effective_to > $1)
    `, [date]);

    const allocation: Record<string, number> = {};
    for (const row of results) {
      allocation[row.chain_name] = parseFloat(row.initial_allocation);
    }

    return Object.keys(allocation).length > 0 ? allocation : this.BASELINE_ALLOCATION;
  }

  /**
   * Store daily performance data in database (updated for new schema)
   */
  private async storeDailyPerformance(data: {
    date: string;
    totalFundAllocationBaseline: string;
    totalFundAllocationOptimized: string;
    differential: string;
    differentialPercentage: number;
    totalInflows: string;
    totalOutflows: string;
    netFlow: string;
    previousDayTotal: string | null;
    chains: ChainPerformanceData[];
  }): Promise<DailyPerformanceData> {
    
    return await transaction(async (client) => {
      // Insert daily performance record with new fields
      const performanceResult = await client.query(`
        INSERT INTO daily_performance 
        (date, total_fund_allocation_baseline, total_fund_allocation_optimized, differential, differential_percentage,
         total_inflows, total_outflows, net_flow, previous_day_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (date) DO UPDATE SET
          total_fund_allocation_baseline = EXCLUDED.total_fund_allocation_baseline,
          total_fund_allocation_optimized = EXCLUDED.total_fund_allocation_optimized,
          differential = EXCLUDED.differential,
          differential_percentage = EXCLUDED.differential_percentage,
          total_inflows = EXCLUDED.total_inflows,
          total_outflows = EXCLUDED.total_outflows,
          net_flow = EXCLUDED.net_flow,
          previous_day_total = EXCLUDED.previous_day_total,
          updated_at = NOW()
        RETURNING *
      `, [
        data.date,
        data.totalFundAllocationBaseline,
        data.totalFundAllocationOptimized,
        data.differential,
        data.differentialPercentage,
        data.totalInflows,
        data.totalOutflows,
        data.netFlow,
        data.previousDayTotal
      ]);

      const performanceRecord = performanceResult.rows[0];

      // Insert chain rates
      for (const chain of data.chains) {
        await client.query(`
          INSERT INTO chain_rates 
          (date, chain_name, apy_baseline, apy_optimized, allocation_baseline, allocation_optimized, utilization_ratio, total_supply)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (date, chain_name) DO UPDATE SET
            apy_baseline = EXCLUDED.apy_baseline,
            apy_optimized = EXCLUDED.apy_optimized,
            allocation_baseline = EXCLUDED.allocation_baseline,
            allocation_optimized = EXCLUDED.allocation_optimized,
            utilization_ratio = EXCLUDED.utilization_ratio,
            total_supply = EXCLUDED.total_supply
        `, [
          data.date,
          chain.chainName,
          chain.apyBaseline,
          chain.apyOptimized,
          chain.allocationBaseline,
          chain.allocationOptimized,
          chain.utilizationRatio,
          chain.totalSupply
        ]);
      }

      return {
        id: performanceRecord.id,
        date: performanceRecord.date,
        totalFundAllocationBaseline: performanceRecord.total_fund_allocation_baseline,
        totalFundAllocationOptimized: performanceRecord.total_fund_allocation_optimized,
        differential: performanceRecord.differential,
        differentialPercentage: performanceRecord.differential_percentage,
        totalInflows: performanceRecord.total_inflows || '0',
        totalOutflows: performanceRecord.total_outflows || '0',
        netFlow: performanceRecord.net_flow || '0',
        previousDayTotal: performanceRecord.previous_day_total,
        chains: data.chains,
        createdAt: performanceRecord.created_at
      };
    });
  }

  /**
   * Get performance data for date range
   */
  async getPerformanceData(startDate: string, endDate: string): Promise<DailyPerformanceData[]> {
    const results = await query(`
      SELECT 
        dp.*,
        json_agg(
          json_build_object(
            'chainName', cr.chain_name,
            'apyBaseline', cr.apy_baseline,
            'apyOptimized', cr.apy_optimized,
            'allocationBaseline', cr.allocation_baseline,
            'allocationOptimized', cr.allocation_optimized,
            'utilizationRatio', cr.utilization_ratio,
            'totalSupply', cr.total_supply
          ) ORDER BY cr.chain_name
        ) as chains
      FROM daily_performance dp
      LEFT JOIN chain_rates cr ON dp.date = cr.date
      WHERE dp.date BETWEEN $1 AND $2
      GROUP BY dp.id, dp.date, dp.total_fund_allocation_baseline, 
               dp.total_fund_allocation_optimized, dp.differential, 
               dp.differential_percentage, dp.total_inflows, dp.total_outflows,
               dp.net_flow, dp.previous_day_total, dp.created_at, dp.updated_at
      ORDER BY dp.date
    `, [startDate, endDate]);

    return results.map(row => ({
      id: row.id,
      date: row.date,
      totalFundAllocationBaseline: row.total_fund_allocation_baseline,
      totalFundAllocationOptimized: row.total_fund_allocation_optimized,
      differential: row.differential,
      differentialPercentage: row.differential_percentage,
      totalInflows: row.total_inflows || '0',
      totalOutflows: row.total_outflows || '0',
      netFlow: row.net_flow || '0',
      previousDayTotal: row.previous_day_total,
      chains: row.chains || [],
      createdAt: row.created_at
    }));
  }

  /**
   * Calculate performance metrics (updated with fund flow data)
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const results = await query(`
      SELECT 
        COUNT(*) as total_days_tracked,
        SUM(differential) as total_gain,
        AVG(differential) as average_daily_gain,
        SUM(differential) / NULLIF(SUM(total_fund_allocation_baseline), 0) * 100 as total_gain_percentage,
        AVG(differential) / NULLIF(AVG(total_fund_allocation_baseline), 0) * 100 as average_daily_gain_percentage,
        STDDEV(differential) as volatility,
        SUM(total_inflows) as total_inflows,
        SUM(total_outflows) as total_outflows,
        SUM(net_flow) as total_net_flow
      FROM daily_performance
      WHERE date >= NOW() - INTERVAL '1 year'
    `);

    const metrics = results[0];

    // Get best and worst performing chains
    const chainMetrics = await query(`
      SELECT 
        chain_name,
        AVG(apy_optimized - apy_baseline) as avg_improvement
      FROM chain_rates
      WHERE date >= NOW() - INTERVAL '30 days'
      GROUP BY chain_name
      ORDER BY avg_improvement DESC
    `);

    const bestChain = chainMetrics[0]?.chain_name || 'N/A';
    const worstChain = chainMetrics[chainMetrics.length - 1]?.chain_name || 'N/A';

    return {
      totalGain: metrics.total_gain || '0',
      totalGainPercentage: parseFloat(metrics.total_gain_percentage) || 0,
      averageDailyGain: metrics.average_daily_gain || '0',
      averageDailyGainPercentage: parseFloat(metrics.average_daily_gain_percentage) || 0,
      bestPerformingChain: bestChain,
      worstPerformingChain: worstChain,
      rebalanceCount: 0, // Would be calculated from rebalancing_history table
      totalDaysTracked: parseInt(metrics.total_days_tracked) || 0,
      volatility: parseFloat(metrics.volatility) || 0,
      totalInflows: metrics.total_inflows || '0',
      totalOutflows: metrics.total_outflows || '0',
      netFlow: metrics.total_net_flow || '0'
    };
  }

  /**
   * Get fund flow summary for a date range
   */
  async getFundFlowSummary(startDate: string, endDate: string) {
    return await query(`
      SELECT * FROM fund_flow_summary
      WHERE date BETWEEN $1 AND $2
      ORDER BY date DESC, chain_name
    `, [startDate, endDate]);
  }
}

export const performanceService = new PerformanceService(); 