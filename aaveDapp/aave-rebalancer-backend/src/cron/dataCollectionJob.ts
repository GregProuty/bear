import { aaveDataService } from '../services/aaveDataService';
import { vaultDataService } from '../services/vaultDataService';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

/**
 * Data collection job that runs periodically to fetch AAVE data
 * This implements the daily data collection described in the document
 */
export async function dataCollectionJob(): Promise<void> {
  const startTime = Date.now();
  logger.info('🔄 Starting AAVE data collection job');

  try {
    // Test all chain connections first
    const connectionResults = await aaveDataService.testAllConnections();
    const connectedChains = Object.entries(connectionResults)
      .filter(([, connected]) => connected)
      .map(([chain]) => chain);

    if (connectedChains.length === 0) {
      throw new Error('No chain connections available');
    }

    logger.info(`📡 Connected to ${connectedChains.length} chains: ${connectedChains.join(', ')}`);

    // Fetch current AAVE pool data for all chains
    const allPoolData = await aaveDataService.getAllChainsData();
    
    if (allPoolData.length === 0) {
      throw new Error('No pool data collected');
    }

    logger.info(`📊 Collected data for ${allPoolData.length} AAVE pools`);

    // Fetch current vault data for all chains with deployed vaults
    const allVaultData = await vaultDataService.getAllVaultsData();
    
    if (allVaultData.length > 0) {
      logger.info(`🏦 Collected data for ${allVaultData.length} vaults`);
    } else {
      logger.warn('⚠️ No vault data collected - no vaults deployed yet?');
    }

    // Store the collected data in database
    const timestamp = new Date();
    const storePromises = [
      ...allPoolData.map(poolData => storeAavePoolData(poolData, timestamp)),
      ...allVaultData.map(vaultData => storeVaultData(vaultData, timestamp))
    ];

    await Promise.all(storePromises);

    const duration = Date.now() - startTime;
    logger.info(`✅ Data collection completed in ${duration}ms`);

    // Log summary statistics
    const summary = allPoolData.map(pool => ({
      chain: pool.chainName,
      apy: pool.supplyAPY.toFixed(2) + '%',
      utilization: pool.utilizationRate.toFixed(2) + '%',
      liquidity: '$' + formatNumber(parseFloat(pool.totalLiquidity))
    }));

    logger.info('📈 Collection summary:', summary);

  } catch (error) {
    logger.error('❌ Data collection job failed:', error);
    throw error;
  }
}

/**
 * Store AAVE pool data in the database
 */
async function storeAavePoolData(poolData: any, timestamp: Date): Promise<void> {
  try {
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

    logger.debug(`Stored pool data for ${poolData.chainName}`);
  } catch (error) {
    logger.error(`Failed to store pool data for ${poolData.chainName}:`, error);
    throw error;
  }
}

/**
 * Store vault data in the database
 */
async function storeVaultData(vaultData: any, timestamp: Date): Promise<void> {
  try {
    await query(`
      INSERT INTO vault_data 
      (chain_name, vault_address, total_assets, total_shares, amount_invested, share_price, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      vaultData.chainName,
      vaultData.vaultAddress,
      vaultData.totalAssets,
      vaultData.totalShares,
      vaultData.totalAssets, // For now, assume all assets are invested
      vaultData.sharePrice,
      timestamp.toISOString()
    ]);

    logger.debug(`Stored vault data for ${vaultData.chainName}`);
  } catch (error) {
    logger.error(`Failed to store vault data for ${vaultData.chainName}:`, error);
    throw error;
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