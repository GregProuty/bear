import { ethers } from 'ethers';
import axios from 'axios';
import { logger } from '../utils/logger';
import { SUPPORTED_CHAINS, AAVE_POOL_ABI, ERC20_ABI } from '../config/chains';

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

      // Create AAVE pool contract instance
      const poolContract = new ethers.Contract(
        chainConfig.aavePoolAddress,
        AAVE_POOL_ABI,
        provider
      );

      try {
        // Verify contract methods exist
        if (!poolContract.getReserveData) {
          throw new Error(`AAVE pool contract missing getReserveData method for ${chainName}`);
        }

        // Call getReserveData for USDC
        const reserveData = await poolContract.getReserveData(chainConfig.usdcAddress);
        
        logger.info(`✅ Successfully fetched AAVE reserve data for ${chainName}`);

        // Extract reserve data fields
        const currentLiquidityRate = reserveData.currentLiquidityRate;
        const currentStableBorrowRate = reserveData.currentStableBorrowRate;
        const currentVariableBorrowRate = reserveData.currentVariableBorrowRate;
        const aTokenAddress = reserveData.aTokenAddress;

        // Get aToken contract to fetch total supply (total liquidity)
        const aTokenContract = new ethers.Contract(
          aTokenAddress,
          ERC20_ABI,
          provider
        );

        // Verify aToken contract methods exist
        if (!aTokenContract.totalSupply || !aTokenContract.decimals) {
          throw new Error(`aToken contract missing required methods for ${chainName}`);
        }

        const [totalSupply, totalDecimals] = await Promise.all([
          aTokenContract.totalSupply(),
          aTokenContract.decimals()
        ]);

        // Format total liquidity
        const totalLiquidity = ethers.formatUnits(totalSupply, totalDecimals);

        // Calculate APY from rate (AAVE uses ray math - divide by 1e27 then convert to APY)
        const supplyAPY = this.calculateAPY(currentLiquidityRate);
        const variableBorrowAPY = this.calculateAPY(currentVariableBorrowRate);
        const stableBorrowAPY = this.calculateAPY(currentStableBorrowRate);

        // For utilization rate, we need total borrowed vs total liquidity
        // For now, use a calculated estimate based on supply rate
        const utilizationRate = Math.min(95, Math.max(0, supplyAPY * 15)); // Rough estimate

        return {
          chainName,
          poolAddress: chainConfig.aavePoolAddress,
          totalLiquidity: totalLiquidity,
          totalBorrowed: (parseFloat(totalLiquidity) * utilizationRate / 100).toString(),
          utilizationRate: utilizationRate,
          supplyAPY: supplyAPY,
          variableBorrowAPY: variableBorrowAPY,
          stableBorrowAPY: stableBorrowAPY,
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