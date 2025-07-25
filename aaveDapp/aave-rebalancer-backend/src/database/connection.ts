import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

let pool: Pool;

export const initializeDatabase = async (): Promise<void> => {
  try {
    // Create connection pool
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 
        `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close clients after 30 seconds of inactivity
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connection pool initialized successfully');

    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
};

export const query = async <T = any>(text: string, params?: any[]): Promise<T[]> => {
  const client = await pool.connect();
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', { text, duration, rows: result.rowCount });
    return result.rows;
  } catch (error) {
    logger.error('Database query error:', { text, params, error });
    throw error;
  } finally {
    client.release();
  }
};

export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
};

export const runMigrations = async (): Promise<void> => {
  try {
    logger.info('🔄 Running database migrations...');
    
    // Create chain enum if it doesn't exist
    await query(`
      DO $$ BEGIN
        CREATE TYPE chain_name_enum AS ENUM ('ethereum', 'base', 'optimism', 'arbitrum', 'polygon');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create aave_pool_data table
    await query(`
      CREATE TABLE IF NOT EXISTS aave_pool_data (
        id SERIAL PRIMARY KEY,
        chain_name chain_name_enum NOT NULL,
        pool_address VARCHAR(42) NOT NULL,
        total_liquidity DECIMAL(38, 8) NOT NULL,
        total_borrowed DECIMAL(38, 8) NOT NULL,
        utilization_rate DECIMAL(12, 8) NOT NULL,
        supply_apy DECIMAL(12, 8) NOT NULL,
        variable_borrow_apy DECIMAL(12, 8) NOT NULL,
        stable_borrow_apy DECIMAL(12, 8) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create other essential tables
    await query(`
      CREATE TABLE IF NOT EXISTS daily_performance (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        total_fund_allocation_baseline DECIMAL(38, 8) NOT NULL,
        total_fund_allocation_optimized DECIMAL(38, 8) NOT NULL,
        differential DECIMAL(38, 8) NOT NULL,
        differential_percentage DECIMAL(12, 8),
        total_inflows DECIMAL(38, 8) DEFAULT 0,
        total_outflows DECIMAL(38, 8) DEFAULT 0,
        net_flow DECIMAL(38, 8) DEFAULT 0,
        previous_day_total DECIMAL(38, 8),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS chain_rates (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        chain_name chain_name_enum NOT NULL,
        apy_baseline DECIMAL(12, 8) NOT NULL,
        apy_optimized DECIMAL(12, 8) NOT NULL,
        allocation_baseline DECIMAL(38, 8) NOT NULL,
        allocation_optimized DECIMAL(38, 8) NOT NULL,
        utilization_ratio DECIMAL(12, 8) NOT NULL,
        total_supply DECIMAL(38, 8) NOT NULL,
        elasticity_factor DECIMAL(12, 8),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_chain_date UNIQUE (date, chain_name)
      );
    `);

    // Create vault_data table for tracking vault performance
    // First drop existing table if it exists (to fix schema mismatch)
    await query(`DROP TABLE IF EXISTS vault_data;`);
    
    await query(`
      CREATE TABLE vault_data (
        id SERIAL PRIMARY KEY,
        chain_name chain_name_enum NOT NULL,
        vault_address VARCHAR(42) NOT NULL,
        total_assets DECIMAL(38, 8) NOT NULL,
        total_shares DECIMAL(38, 8) NOT NULL,
        amount_invested DECIMAL(38, 8) NOT NULL,
        share_price DECIMAL(38, 18) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_aave_pool_data_chain_timestamp 
      ON aave_pool_data(chain_name, timestamp);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_daily_performance_date 
      ON daily_performance(date);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_chain_rates_date_chain 
      ON chain_rates(date, chain_name);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_vault_data_chain_timestamp 
      ON vault_data(chain_name, timestamp);
    `);

    // Create baseline_configuration table
    await query(`
      CREATE TABLE IF NOT EXISTS baseline_configuration (
        id SERIAL PRIMARY KEY,
        chain_name chain_name_enum NOT NULL,
        initial_allocation DECIMAL(38, 8) NOT NULL,
        percentage_allocation DECIMAL(5, 2) NOT NULL,
        effective_from DATE NOT NULL,
        effective_to DATE DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Insert baseline configuration data
    await query(`
      INSERT INTO baseline_configuration 
      (chain_name, initial_allocation, percentage_allocation, effective_from) 
      VALUES 
      ('ethereum', 2500000.00, 50.00, '2024-12-01'),
      ('base', 1000000.00, 20.00, '2024-12-01'),
      ('optimism', 750000.00, 15.00, '2024-12-01'),
      ('arbitrum', 500000.00, 10.00, '2024-12-01'),
      ('polygon', 250000.00, 5.00, '2024-12-01')
      ON CONFLICT DO NOTHING
    `);

    logger.info('✅ Database migrations completed successfully');
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    logger.info('Database connection pool closed');
  }
};

// Helper function to build WHERE clauses dynamically
export const buildWhereClause = (conditions: Record<string, any>): { whereClause: string; values: any[] } => {
  const validConditions = Object.entries(conditions).filter(([, value]) => value !== undefined && value !== null);
  
  if (validConditions.length === 0) {
    return { whereClause: '', values: [] };
  }

  const clauses = validConditions.map(([key, ], index) => `${key} = $${index + 1}`);
  const values = validConditions.map(([, value]) => value);

  return {
    whereClause: `WHERE ${clauses.join(' AND ')}`,
    values
  };
};

// Helper function for date range queries
export const buildDateRangeClause = (
  startDate?: string, 
  endDate?: string, 
  dateColumn = 'date'
): { clause: string; values: any[] } => {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    conditions.push(`${dateColumn} >= $${paramIndex++}`);
    values.push(startDate);
  }

  if (endDate) {
    conditions.push(`${dateColumn} <= $${paramIndex++}`);
    values.push(endDate);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values
  };
}; 