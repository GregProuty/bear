import { aaveDataService } from '../services/aaveDataService';
import { query } from '../database/connection';
import { GraphQLContext } from '../context';

export const aaveResolvers = {
  Query: {
    aavePoolData: async (
      _: any,
      { chainName }: { chainName: string },
      { logger }: GraphQLContext
    ) => {
      try {
        logger.info(`Fetching AAVE pool data for ${chainName} from database`);
        
        // Query the most recent data from database instead of calling service
        const results = await query(`
          SELECT 
            chain_name,
            pool_address,
            total_liquidity,
            total_borrowed,
            utilization_rate,
            supply_apy,
            variable_borrow_apy,
            stable_borrow_apy,
            timestamp as last_update
          FROM aave_pool_data 
          WHERE chain_name = $1 
          ORDER BY timestamp DESC 
          LIMIT 1
        `, [chainName]);

        if (results.length === 0) {
          logger.warn(`No AAVE pool data found for ${chainName} in database`);
          return null;
        }

        const data = results[0];
        return {
          chainName: data.chain_name,
          poolAddress: data.pool_address,
          totalLiquidity: data.total_liquidity,
          totalBorrowed: data.total_borrowed,
          utilizationRate: parseFloat(data.utilization_rate),
          supplyAPY: parseFloat(data.supply_apy),
          variableBorrowAPY: parseFloat(data.variable_borrow_apy),
          stableBorrowAPY: parseFloat(data.stable_borrow_apy),
          lastUpdate: new Date(data.last_update)
        };
      } catch (error) {
        logger.error(`Error fetching AAVE pool data for ${chainName}:`, error);
        throw error;
      }
    },

    allChainData: async (_: any, __: any, { logger }: GraphQLContext) => {
      try {
        logger.info('Fetching all chain data');
        const allPoolData = await aaveDataService.getAllChainsData();
        
        // Transform to ChainData format
        return allPoolData.map(poolData => ({
          chainName: poolData.chainName,
          chainId: getChainId(poolData.chainName),
          aavePool: poolData,
          vaultAddress: getVaultAddress(poolData.chainName),
          totalDeposited: '0', // Would be fetched from vault contracts
          activeUsers: 0, // Would be calculated from vault events
          lastRebalance: null // Would be fetched from rebalancing history
        }));
      } catch (error) {
        logger.error('Error fetching all chain data:', error);
        throw error;
      }
    }
  },

  Mutation: {
    collectAaveData: async (_: any, __: any, { logger }: GraphQLContext) => {
      try {
        logger.info('Manual AAVE data collection triggered');
        const allData = await aaveDataService.getAllChainsData();
        
        // Store the collected data in database
        const timestamp = new Date();
        for (const poolData of allData) {
          await query(`
            INSERT INTO aave_pool_data 
            (chain_name, pool_address, total_liquidity, total_borrowed, utilization_rate, 
             supply_apy, variable_borrow_apy, stable_borrow_apy, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            poolData.chainName,
            poolData.poolAddress,
            poolData.totalLiquidity,
            poolData.totalBorrowed,
            poolData.utilizationRate,
            poolData.supplyAPY,
            poolData.variableBorrowAPY,
            poolData.stableBorrowAPY,
            timestamp
          ]);
        }
        
        logger.info(`Collected and stored data for ${allData.length} AAVE pools`);
        return true;
      } catch (error) {
        logger.error('Error in manual AAVE data collection:', error);
        return false;
      }
    },

    debugEthereum: async (_: any, __: any, { logger }: GraphQLContext) => {
      try {
        logger.info('Debug: Testing Ethereum chain specifically');
        
        // Test connection
        const connectionResults = await aaveDataService.testAllConnections();
        logger.info('Connection results:', connectionResults);
        
        // Test data collection for ethereum specifically
        const ethereumData = await aaveDataService.getAavePoolData('ethereum');
        logger.info('Ethereum data result:', ethereumData);
        
        // Test data collection for base to compare
        const baseData = await aaveDataService.getAavePoolData('base');
        logger.info('Base data result:', baseData);
        
        return {
          connections: connectionResults,
          ethereumData: ethereumData !== null,
          baseData: baseData !== null,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        logger.error('Error in Ethereum debug:', error);
        throw error;
      }
    }
  },

  AavePoolData: {
    // Field resolvers can be added here for complex calculations
    utilizationRate: (parent: any) => {
      // Ensure utilization rate is properly formatted
      const rate = parent.utilizationRate;
      return (isFinite(rate) && rate >= 0) ? Math.round(rate * 100) / 100 : 0;
    },
    
    supplyAPY: (parent: any) => {
      // Ensure APY is properly formatted to 2 decimal places and finite
      const apy = parent.supplyAPY;
      return (isFinite(apy) && apy >= 0) ? Math.round(apy * 100) / 100 : 0;
    },
    
    variableBorrowAPY: (parent: any) => {
      const apy = parent.variableBorrowAPY;
      return (isFinite(apy) && apy >= 0) ? Math.round(apy * 100) / 100 : 0;
    },
    
    stableBorrowAPY: (parent: any) => {
      const apy = parent.stableBorrowAPY;
      return (isFinite(apy) && apy >= 0) ? Math.round(apy * 100) / 100 : 0;
    }
  },

  ChainData: {
    // Field resolvers for chain data
    totalDeposited: async (parent: any, _: any, { logger }: GraphQLContext) => {
      try {
        // In production, this would fetch from vault contracts
        // For now, return placeholder
        return '0';
      } catch (error) {
        logger.error(`Error fetching total deposited for ${parent.chainName}:`, error);
        return '0';
      }
    },

    activeUsers: async (parent: any, _: any, { logger }: GraphQLContext) => {
      try {
        // In production, this would count unique depositors from events
        return 0;
      } catch (error) {
        logger.error(`Error fetching active users for ${parent.chainName}:`, error);
        return 0;
      }
    }
  }
};

// Helper functions
function getChainId(chainName: string): number {
  const chainIds: Record<string, number> = {
    ethereum: 1,
    base: 8453,
    optimism: 10,
    arbitrum: 42161,
    polygon: 137
  };
  return chainIds[chainName.toLowerCase()] || 0;
}

function getVaultAddress(chainName: string): string | undefined {
  // These would come from environment variables or config
  const vaultAddresses: Record<string, string> = {
    ethereum: process.env.AAVE_VAULT_ETHEREUM || '',
    base: process.env.AAVE_VAULT_BASE || '',
    optimism: process.env.AAVE_VAULT_OPTIMISM || '',
    arbitrum: process.env.AAVE_VAULT_ARBITRUM || '',
    polygon: process.env.AAVE_VAULT_POLYGON || ''
  };
  
  const address = vaultAddresses[chainName.toLowerCase()];
  return address || undefined;
} 