import { vaultDataService } from '../services/vaultDataService';
import { query } from '../database/connection';
import { GraphQLContext } from '../context';

export const vaultResolvers = {
  Query: {
    vaultData: async (
      _: any,
      { chainName }: { chainName: string },
      { logger }: GraphQLContext
    ) => {
      try {
        logger.info(`Fetching vault data for ${chainName}`);
        return await vaultDataService.getVaultData(chainName);
      } catch (error) {
        logger.error(`Error fetching vault data for ${chainName}:`, error);
        throw error;
      }
    },

    allVaultData: async (_: any, __: any, { logger }: GraphQLContext) => {
      try {
        logger.info('Fetching all vault data');
        return await vaultDataService.getAllVaultsData();
      } catch (error) {
        logger.error('Error fetching all vault data:', error);
        throw error;
      }
    },

    historicalVaultData: async (
      _: any,
      { chainName, days = 30 }: { chainName: string; days?: number },
      { logger }: GraphQLContext
    ) => {
      try {
        logger.info(`Fetching historical vault data for ${chainName} (${days} days)`);
        
        const result = await query(`
          SELECT 
            chain_name,
            vault_address,
            total_assets,
            total_shares,
            share_price,
            timestamp
          FROM vault_data 
          WHERE chain_name = $1 
            AND timestamp >= NOW() - INTERVAL '${days} days'
          ORDER BY timestamp DESC
        `, [chainName]);

        return result.map((row: any) => ({
          chainName: row.chain_name,
          vaultAddress: row.vault_address,
          totalAssets: row.total_assets,
          totalShares: row.total_shares,
          sharePrice: parseFloat(row.share_price),
          assetDecimals: 6, // USDC standard
          shareDecimals: 18, // ERC20 standard
          lastUpdate: row.timestamp
        }));

      } catch (error) {
        logger.error(`Error fetching historical vault data for ${chainName}:`, error);
        throw error;
      }
    },

    sharePriceHistory: async (
      _: any,
      { chainName, days = 30 }: { chainName: string; days?: number },
      { logger }: GraphQLContext
    ) => {
      try {
        logger.info(`Fetching share price history for ${chainName} (${days} days)`);
        
        const result = await query(`
          SELECT 
            DATE(timestamp) as date,
            AVG(share_price) as avg_share_price,
            MIN(share_price) as min_share_price,
            MAX(share_price) as max_share_price,
            COUNT(*) as data_points
          FROM vault_data 
          WHERE chain_name = $1 
            AND timestamp >= NOW() - INTERVAL '${days} days'
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
        `, [chainName]);

        return result.map((row: any) => ({
          date: row.date,
          sharePrice: parseFloat(row.avg_share_price),
          minSharePrice: parseFloat(row.min_share_price),
          maxSharePrice: parseFloat(row.max_share_price),
          dataPoints: parseInt(row.data_points)
        }));

      } catch (error) {
        logger.error(`Error fetching share price history for ${chainName}:`, error);
        throw error;
      }
    }
  },

  Mutation: {
    collectVaultData: async (_: any, __: any, { logger }: GraphQLContext) => {
      try {
        logger.info('Manual vault data collection triggered');
        const allData = await vaultDataService.getAllVaultsData();
        
        // Store the collected data in database
        const timestamp = new Date();
        for (const vaultData of allData) {
          await query(`
            INSERT INTO vault_data 
            (chain_name, vault_address, total_assets, total_shares, amount_invested, share_price, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            vaultData.chainName,
            vaultData.vaultAddress,
            vaultData.totalAssets,
            vaultData.totalShares,
            vaultData.totalAssets, // Assume all assets are invested for now
            vaultData.sharePrice,
            timestamp.toISOString()
          ]);
        }
        
        logger.info(`Collected and stored data for ${allData.length} vaults`);
        return true;
      } catch (error) {
        logger.error('Error in manual vault data collection:', error);
        return false;
      }
    }
  },

  VaultData: {
    // Field resolvers for computed values
    sharePriceFormatted: (parent: any) => {
      return parent.sharePrice.toFixed(8);
    },

    totalAssetsUSD: (parent: any) => {
      // Format as USD currency
      const value = parseFloat(parent.totalAssets);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    },

    performance24h: async (parent: any) => {
      try {
        // Get share price from 24 hours ago
        const result = await query(`
          SELECT share_price 
          FROM vault_data 
          WHERE chain_name = $1 
            AND timestamp <= NOW() - INTERVAL '24 hours'
          ORDER BY timestamp DESC 
          LIMIT 1
        `, [parent.chainName]);

        if (result.length === 0) {
          return 0;
        }

        const previousPrice = parseFloat(result[0].share_price);
        const currentPrice = parent.sharePrice;
        
        return ((currentPrice - previousPrice) / previousPrice) * 100;
      } catch (error) {
        return 0;
      }
    }
  }
}; 