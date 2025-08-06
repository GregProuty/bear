#!/usr/bin/env tsx

import 'dotenv/config';
import { initializeDatabase, query, closeDatabase } from './connection';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

async function migrate() {
  try {
    logger.info('🔄 Starting database migration...');
    
    await initializeDatabase();
    
    // Check if we need to migrate from old schema
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'daily_performance' 
        AND column_name = 'total_fund_allocation_baseline'
        AND data_type = 'numeric'
        AND numeric_precision = 20
        AND numeric_scale = 2
      )
    `);
    
    const needsMigration = tableExists[0]?.exists;
    
    if (needsMigration) {
      logger.info('📊 Migrating from old schema with DECIMAL(20,2) to new high-precision schema...');
      
      // Step 1: Add new columns with increased precision
      logger.info('🔧 Adding new high-precision columns...');
      
      await query(`
        -- Add new columns to daily_performance
        ALTER TABLE daily_performance 
        ADD COLUMN IF NOT EXISTS total_fund_allocation_baseline_new DECIMAL(38, 8),
        ADD COLUMN IF NOT EXISTS total_fund_allocation_optimized_new DECIMAL(38, 8),
        ADD COLUMN IF NOT EXISTS differential_new DECIMAL(38, 8),
        ADD COLUMN IF NOT EXISTS differential_percentage_new DECIMAL(12, 8),
        ADD COLUMN IF NOT EXISTS total_inflows DECIMAL(38, 8) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_outflows DECIMAL(38, 8) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS net_flow DECIMAL(38, 8) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS previous_day_total DECIMAL(38, 8);
      `);
      
      await query(`
        -- Add new columns to chain_rates
        ALTER TABLE chain_rates
        ADD COLUMN IF NOT EXISTS apy_baseline_new DECIMAL(12, 8),
        ADD COLUMN IF NOT EXISTS apy_optimized_new DECIMAL(12, 8),
        ADD COLUMN IF NOT EXISTS allocation_baseline_new DECIMAL(38, 8),
        ADD COLUMN IF NOT EXISTS allocation_optimized_new DECIMAL(38, 8),
        ADD COLUMN IF NOT EXISTS utilization_ratio_new DECIMAL(12, 8),
        ADD COLUMN IF NOT EXISTS total_supply_new DECIMAL(38, 8),
        ADD COLUMN IF NOT EXISTS elasticity_factor_new DECIMAL(12, 8);
      `);
      
      // Step 2: Copy data to new columns
      logger.info('📋 Copying data to new columns...');
      
      await query(`
        UPDATE daily_performance SET
          total_fund_allocation_baseline_new = total_fund_allocation_baseline,
          total_fund_allocation_optimized_new = total_fund_allocation_optimized,
          differential_new = differential,
          differential_percentage_new = differential_percentage
        WHERE total_fund_allocation_baseline_new IS NULL;
      `);
      
      await query(`
        UPDATE chain_rates SET
          apy_baseline_new = apy_baseline,
          apy_optimized_new = apy_optimized,
          allocation_baseline_new = allocation_baseline,
          allocation_optimized_new = allocation_optimized,
          utilization_ratio_new = utilization_ratio,
          total_supply_new = total_supply,
          elasticity_factor_new = elasticity_factor
        WHERE apy_baseline_new IS NULL;
      `);
      
      // Step 3: Drop dependent views first, then old columns and rename new ones
      logger.info('🗑️ Dropping dependent views...');
      
      await query(`
        DROP VIEW IF EXISTS latest_performance CASCADE;
        DROP VIEW IF EXISTS performance_summary CASCADE;
        DROP VIEW IF EXISTS fund_flow_summary CASCADE;
        DROP VIEW IF EXISTS chain_performance_comparison CASCADE;
      `);
      
      logger.info('🗑️ Dropping old columns and renaming new ones...');
      
      await query(`
        ALTER TABLE daily_performance
        DROP COLUMN IF EXISTS total_fund_allocation_baseline,
        DROP COLUMN IF EXISTS total_fund_allocation_optimized,
        DROP COLUMN IF EXISTS differential,
        DROP COLUMN IF EXISTS differential_percentage;
      `);
      
      await query(`
        ALTER TABLE daily_performance
        RENAME COLUMN total_fund_allocation_baseline_new TO total_fund_allocation_baseline;
        ALTER TABLE daily_performance
        RENAME COLUMN total_fund_allocation_optimized_new TO total_fund_allocation_optimized;
        ALTER TABLE daily_performance
        RENAME COLUMN differential_new TO differential;
        ALTER TABLE daily_performance
        RENAME COLUMN differential_percentage_new TO differential_percentage;
      `);
      
      await query(`
        ALTER TABLE chain_rates
        DROP COLUMN IF EXISTS apy_baseline,
        DROP COLUMN IF EXISTS apy_optimized,
        DROP COLUMN IF EXISTS allocation_baseline,
        DROP COLUMN IF EXISTS allocation_optimized,
        DROP COLUMN IF EXISTS utilization_ratio,
        DROP COLUMN IF EXISTS total_supply,
        DROP COLUMN IF EXISTS elasticity_factor;
      `);
      
      await query(`
        ALTER TABLE chain_rates
        RENAME COLUMN apy_baseline_new TO apy_baseline;
        ALTER TABLE chain_rates
        RENAME COLUMN apy_optimized_new TO apy_optimized;
        ALTER TABLE chain_rates
        RENAME COLUMN allocation_baseline_new TO allocation_baseline;
        ALTER TABLE chain_rates
        RENAME COLUMN allocation_optimized_new TO allocation_optimized;
        ALTER TABLE chain_rates
        RENAME COLUMN utilization_ratio_new TO utilization_ratio;
        ALTER TABLE chain_rates
        RENAME COLUMN total_supply_new TO total_supply;
        ALTER TABLE chain_rates
        RENAME COLUMN elasticity_factor_new TO elasticity_factor;
      `);
      
      // Step 4: Recreate views with new schema
      logger.info('📊 Recreating database views with new schema...');
      
      await query(`
        CREATE VIEW latest_performance AS
        SELECT * FROM daily_performance
        ORDER BY date DESC
        LIMIT 1;
      `);
      
      await query(`
        CREATE VIEW fund_flow_summary AS
        SELECT 
          date,
          chain_name,
          SUM(CASE WHEN flow_type = 'deposit' THEN amount ELSE 0 END) as daily_inflows,
          SUM(CASE WHEN flow_type = 'withdrawal' THEN amount ELSE 0 END) as daily_outflows,
          SUM(CASE WHEN flow_type = 'deposit' THEN amount ELSE -amount END) as daily_net_flow
        FROM fund_flows
        GROUP BY date, chain_name
        ORDER BY date DESC, chain_name;
      `);
      
      await query(`
        CREATE VIEW performance_summary AS
        SELECT 
          COUNT(*) as total_days,
          SUM(differential) as total_differential,
          AVG(differential) as average_differential,
          MAX(differential) as max_differential,
          MIN(differential) as min_differential,
          STDDEV(differential) as differential_stddev,
          COALESCE(SUM(total_inflows), 0) as total_inflows,
          COALESCE(SUM(total_outflows), 0) as total_outflows,
          COALESCE(SUM(net_flow), 0) as total_net_flow,
          MIN(date) as start_date,
          MAX(date) as end_date
        FROM daily_performance;
      `);
      
      logger.info('✅ Schema migration completed');
    } else {
      logger.info('📊 Schema already up to date');
    }
    
    // Create fund_flows table if it doesn't exist
    logger.info('💰 Creating fund_flows table...');
    await query(`
      CREATE TABLE IF NOT EXISTS fund_flows (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        chain_name chain_name_enum NOT NULL,
        flow_type VARCHAR(10) NOT NULL CHECK (flow_type IN ('deposit', 'withdrawal')),
        amount DECIMAL(38, 8) NOT NULL,
        user_address VARCHAR(42),
        transaction_hash VARCHAR(66),
        block_number BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Add indexes if they don't exist
    await query(`
      CREATE INDEX IF NOT EXISTS idx_fund_flows_date ON fund_flows(date);
      CREATE INDEX IF NOT EXISTS idx_fund_flows_type_date ON fund_flows(flow_type, date);
      CREATE INDEX IF NOT EXISTS idx_fund_flows_chain_date ON fund_flows(chain_name, date);
    `);
    
    // Create fund flow calculation function
    await query(`
      CREATE OR REPLACE FUNCTION calculate_daily_net_flow(target_date DATE, target_chain chain_name_enum)
      RETURNS DECIMAL(38, 8) AS $$
      DECLARE
          total_inflows DECIMAL(38, 8) := 0;
          total_outflows DECIMAL(38, 8) := 0;
      BEGIN
          SELECT COALESCE(SUM(amount), 0) INTO total_inflows
          FROM fund_flows 
          WHERE date = target_date 
          AND chain_name = target_chain 
          AND flow_type = 'deposit';
          
          SELECT COALESCE(SUM(amount), 0) INTO total_outflows
          FROM fund_flows 
          WHERE date = target_date 
          AND chain_name = target_chain 
          AND flow_type = 'withdrawal';
          
          RETURN total_inflows - total_outflows;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Add testnet chains to enum (if not already present)
    logger.info('🔧 Adding testnet chains to enum...');
    const testnetChains = ['arbitrumSepolia', 'optimismSepolia', 'baseSepolia', 'ethereumSepolia'];
    
    for (const chain of testnetChains) {
      try {
        await query(`ALTER TYPE chain_name_enum ADD VALUE IF NOT EXISTS '${chain}';`);
        logger.info(`✅ Added enum value: ${chain}`);
      } catch (error) {
        if (error.message?.includes('already exists')) {
          logger.info(`ℹ️  Enum value already exists: ${chain}`);
        } else {
          logger.warn(`⚠️  Could not add enum value ${chain}:`, error.message);
        }
      }
    }
    
    // Update baseline configuration to include testnet chains
    await query(`
      INSERT INTO baseline_configuration (chain_name, initial_allocation, percentage_allocation, effective_from) 
      VALUES
        ('arbitrumSepolia', 0.00, 0.00, CURRENT_DATE),
        ('optimismSepolia', 0.00, 0.00, CURRENT_DATE),
        ('baseSepolia', 0.00, 0.00, CURRENT_DATE),
        ('ethereumSepolia', 0.00, 0.00, CURRENT_DATE)
      ON CONFLICT (chain_name, effective_to) DO NOTHING;
    `);
    
    // Views will be recreated after schema migration if needed
    
    logger.info('✅ Database migration completed successfully');
    
  } catch (error) {
    logger.error('❌ Database migration failed:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

// Export the migration function
export { migrate };

// Run migration if called directly
if (require.main === module) {
  migrate().catch((error) => {
    logger.error('Migration failed:', error);
    process.exit(1);
  });
} 