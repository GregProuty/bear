import { aaveDataService } from '../services/aaveDataService';
import { performanceService } from '../services/performanceService';
import { GraphQLContext } from '../context';

export const allocationResolvers = {
  Query: {
    currentAllocation: async (_: any, __: any, { logger }: GraphQLContext) => {
      try {
        logger.info('Fetching current allocation data');
        
        // Get the latest performance data to determine current allocations
        const today = new Date().toISOString().split('T')[0]!;
        const performanceDataArray = await performanceService.getPerformanceData(today, today);
        const latestPerformance = performanceDataArray.length > 0 ? performanceDataArray[0] : null;
        
        if (latestPerformance) {
          // Use performance data if available
          const chains = latestPerformance.chains.map((chain: any) => ({
            name: chain.chainName,
            apy: chain.apyOptimized,
            allocation: calculateAllocationPercentage(
              parseFloat(chain.allocationOptimized),
              parseFloat(latestPerformance.totalFundAllocationOptimized)
            ),
            totalValue: chain.allocationOptimized,
            color: getChainColor(chain.chainName),
            icon: getChainIcon(chain.chainName)
          }));

          return {
            chains,
            totalValue: latestPerformance.totalFundAllocationOptimized,
            lastUpdate: latestPerformance.createdAt.toISOString()
          };
        } else {
          // Fallback to real-time AAVE data
          const utilizationData = await aaveDataService.getUtilizationData();
          
          // Use default allocation for fallback
          const defaultAllocations = {
            ethereum: 4000000,
            base: 1000000
          };
          
          const totalValue = Object.values(defaultAllocations).reduce((sum, val) => sum + val, 0);
          
          const chains = utilizationData
            .filter(chain => defaultAllocations[chain.chainName as keyof typeof defaultAllocations])
            .map(chain => {
              const allocation = defaultAllocations[chain.chainName as keyof typeof defaultAllocations];
              return {
                name: chain.chainName,
                apy: chain.supplyAPY,
                allocation: (allocation / totalValue) * 100,
                totalValue: allocation.toString(),
                color: getChainColor(chain.chainName),
                icon: getChainIcon(chain.chainName)
              };
            });

          return {
            chains,
            totalValue: totalValue.toString(),
            lastUpdate: new Date().toISOString()
          };
        }
      } catch (error) {
        logger.error('Error fetching current allocation:', error);
        throw error;
      }
    },

    chainRates: async (
      _: any,
      { chainName, date }: { chainName?: string; date?: string },
      { logger }: GraphQLContext
    ) => {
      try {
        logger.info('Fetching chain rates', { chainName, date });
        
        let query = `
          SELECT * FROM chain_rates 
          WHERE 1=1
        `;
        const params: any[] = [];
        let paramIndex = 1;

        if (chainName) {
          query += ` AND chain_name = $${paramIndex++}`;
          params.push(chainName);
        }

        if (date) {
          query += ` AND date = $${paramIndex++}`;
          params.push(date);
        } else {
          // Default to last 30 days if no date specified
          query += ` AND date >= CURRENT_DATE - INTERVAL '30 days'`;
        }

        query += ` ORDER BY date DESC, chain_name`;

        const { query: dbQuery } = await import('../database/connection');
        const results = await dbQuery(query, params);

        return results.map(row => ({
          id: row.id,
          date: row.date,
          chainName: row.chain_name,
          apyBaseline: parseFloat(row.apy_baseline),
          apyOptimized: parseFloat(row.apy_optimized),
          utilizationRatio: parseFloat(row.utilization_ratio),
          totalSupply: row.total_supply,
          elasticityFactor: parseFloat(row.elasticity_factor) || 0.2,
          createdAt: row.created_at
        }));
      } catch (error) {
        logger.error('Error fetching chain rates:', error);
        throw error;
      }
    }
  },

  Subscription: {
    allocationUpdate: {
      // Real-time allocation updates
      subscribe: async function* (_: any, __: any, { logger }: GraphQLContext) {
        // In production, this would use Redis/WebSockets for real-time updates
        logger.info('Starting allocation update subscription');
        yield { allocationUpdate: null };
      }
    }
  },

  AllocationData: {
    // Field resolvers for allocation data
    totalValue: (parent: any) => {
      // Ensure proper decimal formatting
      return parseFloat(parent.totalValue).toFixed(2);
    }
  }
};

// Helper functions
function calculateAllocationPercentage(amount: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((amount / total) * 100 * 100) / 100; // Round to 2 decimal places
}

function getChainColor(chainName: string): string {
  const colors: Record<string, string> = {
    ethereum: '#627EEA',
    base: '#0052FF',
    optimism: '#FF0420',
    arbitrum: '#28A0F0',
    polygon: '#8247E5'
  };
  return colors[chainName.toLowerCase()] || '#666666';
}

function getChainIcon(chainName: string): string {
  const icons: Record<string, string> = {
    ethereum: 'Ξ',
    base: 'B',
    optimism: 'O',
    arbitrum: 'A',
    polygon: 'P'
  };
  return icons[chainName.toLowerCase()] || chainName.charAt(0).toUpperCase();
} 