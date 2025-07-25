import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { SUPPORTED_CHAINS, VAULT_ABI } from '../config/chains';

export interface VaultData {
  chainName: string;
  vaultAddress: string;
  totalAssets: string;
  totalShares: string;
  sharePrice: number;
  assetDecimals: number;
  shareDecimals: number;
  lastUpdate: Date;
}

export class VaultDataService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    Object.entries(SUPPORTED_CHAINS).forEach(([chainName, config]) => {
      if (config.rpcUrl) {
        try {
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);
          this.providers.set(chainName, provider);
          logger.info(`✅ Vault service provider initialized for ${chainName}`);
        } catch (error) {
          logger.error(`❌ Failed to initialize provider for ${chainName}:`, error);
        }
      } else {
        logger.warn(`⚠️ No RPC URL configured for ${chainName}`);
      }
    });
  }

  /**
   * Test connections to all chains
   */
  async testAllConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [chainName, provider] of this.providers.entries()) {
      try {
        await provider.getBlockNumber();
        results[chainName] = true;
        logger.info(`✅ ${chainName} connection successful`);
      } catch (error) {
        results[chainName] = false;
        logger.error(`❌ ${chainName} connection failed:`, error);
      }
    }
    
    return results;
  }

  /**
   * Fetch vault data for a specific chain
   */
  async getVaultData(chainName: string): Promise<VaultData | null> {
    try {
      const provider = this.providers.get(chainName);
      const chainConfig = SUPPORTED_CHAINS[chainName];
      
      if (!provider || !chainConfig) {
        logger.error(`No provider or config found for chain: ${chainName}`);
        return null;
      }

      if (!chainConfig.vaultAddress) {
        logger.warn(`No vault address configured for ${chainName}`);
        return null;
      }

      // Create vault contract instance
      const vaultContract = new ethers.Contract(
        chainConfig.vaultAddress,
        VAULT_ABI,
        provider
      );

      // Verify contract methods exist
      if (!vaultContract.totalAssets || !vaultContract.totalSupply || !vaultContract.decimals) {
        throw new Error(`Vault contract missing required methods for ${chainName}`);
      }

      // Query vault data
      const [totalAssets, totalSupply, decimals] = await Promise.all([
        vaultContract.totalAssets(),
        vaultContract.totalSupply(), 
        vaultContract.decimals()
      ]);

      // Get decimals (USDC has 6 decimals, vault shares have the decimals returned by contract)
      const assetDecimals = 6; // USDC standard
      const shareDecimals = Number(decimals); // Vault decimals (6 for this vault)

      // Format values using proper decimal handling
      const totalAssetsFormatted = ethers.formatUnits(totalAssets, assetDecimals);
      const totalSharesFormatted = ethers.formatUnits(totalSupply, shareDecimals);

      // Calculate share price (assets per share)
      let sharePrice = 1.0; // Default to 1.0 if no shares outstanding
      if (totalSupply > 0n) {
        // Use formatUnits to handle decimals properly
        const assetsDecimal = parseFloat(ethers.formatUnits(totalAssets, assetDecimals));
        const sharesDecimal = parseFloat(ethers.formatUnits(totalSupply, shareDecimals));
        
        if (sharesDecimal > 0) {
          sharePrice = assetsDecimal / sharesDecimal;
        }
      }

      logger.info(`📊 Vault data for ${chainName}:`, {
        totalAssets: totalAssetsFormatted,
        totalShares: totalSharesFormatted,
        sharePrice: sharePrice.toFixed(8),
        vaultAddress: chainConfig.vaultAddress
      });

      return {
        chainName,
        vaultAddress: chainConfig.vaultAddress,
        totalAssets: totalAssetsFormatted,
        totalShares: totalSharesFormatted,
        sharePrice,
        assetDecimals,
        shareDecimals,
        lastUpdate: new Date()
      };

    } catch (error) {
      logger.error(`Error fetching vault data for ${chainName}:`, error);
      return null;
    }
  }

  /**
   * Fetch vault data for all chains that have vaults deployed
   */
  async getAllVaultsData(): Promise<VaultData[]> {
    const chainsWithVaults = Object.entries(SUPPORTED_CHAINS)
      .filter(([, config]) => config.vaultAddress)
      .map(([chainName]) => chainName);

    if (chainsWithVaults.length === 0) {
      logger.warn('No vaults configured for any chains');
      return [];
    }

    logger.info(`Fetching vault data for chains: ${chainsWithVaults.join(', ')}`);

    const promises = chainsWithVaults.map(chainName => 
      this.getVaultData(chainName)
    );

    const results = await Promise.allSettled(promises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<VaultData> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  /**
   * Get historical share price change for a vault
   */
  async getSharePriceChange(chainName: string, days: number = 1): Promise<number> {
    try {
      // This would typically query historical data from database
      // For now, return 0 as placeholder
      return 0;
    } catch (error) {
      logger.error(`Error calculating share price change for ${chainName}:`, error);
      return 0;
    }
  }
}

// Export singleton instance
export const vaultDataService = new VaultDataService(); 