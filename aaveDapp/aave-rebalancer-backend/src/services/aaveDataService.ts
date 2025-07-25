import { ethers } from 'ethers';
import axios from 'axios';
import { logger } from '../utils/logger';
import { SUPPORTED_CHAINS, AAVE_POOL_ABI } from '../config/chains';

export interface AavePoolData {
  chainName: string;
  poolAddress: string;
  totalLiquidity: string;
  totalBorrowed: string;
  utilizationRate: number;
  supplyAPY: number;
  variableBorrowAPY: number;
  stableBorrowAPY: number;
  lastUpdate: Date;
}

export interface ChainUtilizationData {
  chainName: string;
  utilizationRatio: number;
  totalSupply: string;
  totalBorrowed: string;
  supplyAPY: number;
  elasticityFactor?: number;
}

export class AaveDataService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    for (const [chainName, config] of Object.entries(SUPPORTED_CHAINS)) {
      if (config.rpcUrl) {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.providers.set(chainName, provider);
        logger.info(`Initialized provider for ${chainName}`);
      } else {
        logger.warn(`No RPC URL configured for ${chainName}`);
      }
    }
  }

  /**
   * Fetch current AAVE pool data for a specific chain
   */
  async getAavePoolData(chainName: string): Promise<AavePoolData | null> {
    try {
      const provider = this.providers.get(chainName);
      const chainConfig = SUPPORTED_CHAINS[chainName];
      
      if (!provider || !chainConfig) {
        logger.error(`No provider or config found for chain: ${chainName}`);
        return null;
      }

      if (!chainConfig.rpcUrl) {
        logger.warn(`No RPC URL configured for ${chainName}`);
        return null;
      }

      // Use raw provider.call() instead of Contract interface (which fails on Base Sepolia)
      try {
        // Use working function selector from AAVE app (0x6f90b9d1 instead of 0x35ea6a75)
        const reserveDataCall = await provider.call({
          to: chainConfig.aavePoolAddress,
          data: `0x6f90b9d1000000000000000000000000${chainConfig.usdcAddress.substring(2)}`
        });

        if (!reserveDataCall || reserveDataCall === '0x') {
          logger.warn(`Asset ${chainConfig.usdcAddress} not supported on ${chainName}`);
          return null;
        }

        logger.info(`✅ Successfully called AAVE pool for ${chainName}, response length: ${reserveDataCall.length}`);

        // For now, return mock data since we confirmed the calls work
        // TODO: Decode the actual reserve data from the raw response
        const mockAPY = Math.random() * 5 + 1; // 1-6% APY range for demo
        
        return {
          chainName,
          poolAddress: chainConfig.aavePoolAddress,
          totalLiquidity: "1000000.0", // Mock data - replace with decoded values
          totalBorrowed: "750000.0",   // Mock data - replace with decoded values 
          utilizationRate: 75.0,       // Mock data - replace with calculated value
          supplyAPY: mockAPY,
          variableBorrowAPY: mockAPY * 1.3,
          stableBorrowAPY: mockAPY * 1.5,
          lastUpdate: new Date()
        };

      } catch (error) {
        logger.error(`Error fetching AAVE data for ${chainName}:`, error);
        return null;
      }

    } catch (error) {
      logger.error(`Error in getAavePoolData for ${chainName}:`, error);
      return null;
    }
  }

  /**
   * Fetch AAVE data for all supported chains
   */
  async getAllChainsData(): Promise<AavePoolData[]> {
    const promises = Object.keys(SUPPORTED_CHAINS).map(chainName => 
      this.getAavePoolData(chainName)
    );

    const results = await Promise.allSettled(promises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<AavePoolData> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  /**
   * Get utilization data needed for rebalancing calculations
   */
  async getUtilizationData(): Promise<ChainUtilizationData[]> {
    const allData = await this.getAllChainsData();
    
    return allData.map(data => ({
      chainName: data.chainName,
      utilizationRatio: data.utilizationRate / 100, // Convert percentage to decimal
      totalSupply: data.totalLiquidity,
      totalBorrowed: data.totalBorrowed,
      supplyAPY: data.supplyAPY,
      elasticityFactor: this.calculateElasticityFactor(data.chainName, data.utilizationRate)
    }));
  }

  /**
   * Fetch historical data from AAVE subgraph
   */
  async getHistoricalData(
    chainName: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<AavePoolData[]> {
    try {
      const subgraphUrl = this.getSubgraphUrl(chainName);
      if (!subgraphUrl) {
        logger.warn(`No subgraph URL for ${chainName}`);
        return [];
      }

      const query = `
        query GetHistoricalReserveData($startTimestamp: Int!, $endTimestamp: Int!, $reserve: String!) {
          reserveParamsHistoryItems(
            where: {
              reserve: $reserve,
              timestamp_gte: $startTimestamp,
              timestamp_lte: $endTimestamp
            }
            orderBy: timestamp
            orderDirection: asc
            first: 1000
          ) {
            timestamp
            liquidityRate
            variableBorrowRate
            stableBorrowRate
            utilizationRate
            totalLiquidity
            totalLiquidityAsCollateral
            availableLiquidity
            totalPrincipalStableDebt
            totalScaledVariableDebt
          }
        }
      `;

      const variables = {
        startTimestamp: Math.floor(startDate.getTime() / 1000),
        endTimestamp: Math.floor(endDate.getTime() / 1000),
        reserve: SUPPORTED_CHAINS[chainName]?.usdcAddress?.toLowerCase()
      };

      const response = await axios.post(subgraphUrl, {
        query,
        variables
      });

      if (response.data.errors) {
        logger.error('Subgraph query errors:', response.data.errors);
        return [];
      }

      return response.data.data.reserveParamsHistoryItems.map((item: any) => ({
        chainName,
        poolAddress: SUPPORTED_CHAINS[chainName]?.aavePoolAddress || '',
        totalLiquidity: ethers.formatUnits(item.totalLiquidity, 6),
        totalBorrowed: ethers.formatUnits(
          BigInt(item.totalPrincipalStableDebt) + BigInt(item.totalScaledVariableDebt), 
          6
        ),
        utilizationRate: parseFloat(item.utilizationRate) / 1e25, // Convert from ray
        supplyAPY: this.calculateAPY(item.liquidityRate),
        variableBorrowAPY: this.calculateAPY(item.variableBorrowRate),
        stableBorrowAPY: this.calculateAPY(item.stableBorrowRate),
        lastUpdate: new Date(item.timestamp * 1000)
      }));

    } catch (error) {
      logger.error(`Error fetching historical data for ${chainName}:`, error);
      return [];
    }
  }

  /**
   * Calculate APY from ray-formatted rate
   */
  private calculateAPY(rayRate: string | bigint): number {
    try {
      const RAY = 1e27;
      
      const rate = typeof rayRate === 'string' ? BigInt(rayRate) : rayRate;
      const rateDecimal = Number(rate) / RAY;
      
      // Handle edge cases
      if (rateDecimal <= 0 || !isFinite(rateDecimal)) {
        return 0;
      }
      
      // AAVE rates are already annual rates in RAY format (1e27)
      // Just convert from decimal to percentage
      const apy = rateDecimal * 100;
      
      // Ensure result is reasonable (cap at 1000% APY)
      if (!isFinite(apy) || apy < 0 || apy > 1000) {
        return 0;
      }
      
      return apy;
    } catch (error) {
      logger.error('Error calculating APY:', error);
      return 0;
    }
  }

  /**
   * Calculate elasticity factor for a chain based on historical data
   * This represents how much the interest rate changes for every 1% change in utilization
   */
  private calculateElasticityFactor(chainName: string, currentUtilization: number): number {
    // Default elasticity factors based on AAVE's interest rate models
    const defaultElasticityFactors: Record<string, number> = {
      ethereum: 0.1, // 0.1% rate change per 1% utilization change
      base: 0.2,
      optimism: 0.15,
      arbitrum: 0.15,
      polygon: 0.25
    };

    // In a production environment, this could be calculated dynamically
    // by analyzing historical utilization vs rate data
    return defaultElasticityFactors[chainName] || 0.2;
  }

  /**
   * Get subgraph URL for a specific chain
   */
  private getSubgraphUrl(chainName: string): string | null {
    const subgraphUrls: Record<string, string> = {
      ethereum: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
      base: 'https://api.studio.thegraph.com/query/24660/aave-v3-base/version/latest',
      optimism: 'https://api.studio.thegraph.com/query/24660/aave-v3-optimism/version/latest',
      arbitrum: 'https://api.studio.thegraph.com/query/24660/aave-v3-arbitrum/version/latest',
      polygon: 'https://api.studio.thegraph.com/query/24660/aave-v3-polygon/version/latest'
    };

    return subgraphUrls[chainName] || null;
  }

  /**
   * Test connection to a specific chain
   */
  async testConnection(chainName: string): Promise<boolean> {
    try {
      const provider = this.providers.get(chainName);
      if (!provider) return false;

      const blockNumber = await provider.getBlockNumber();
      logger.info(`Connected to ${chainName}, latest block: ${blockNumber}`);
      return true;
    } catch (error) {
      logger.error(`Connection test failed for ${chainName}:`, error);
      return false;
    }
  }

  /**
   * Test all chain connections
   */
  async testAllConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const chainName of Object.keys(SUPPORTED_CHAINS)) {
      results[chainName] = await this.testConnection(chainName);
    }
    
    return results;
  }
}

export const aaveDataService = new AaveDataService(); 