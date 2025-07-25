-- AAVE Rebalancer Performance Tracking Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE chain_name_enum AS ENUM ('ethereum', 'base', 'optimism', 'arbitrum', 'polygon');

-- Daily performance snapshots
-- This is the core table that tracks the differential between baseline and optimized scenarios
CREATE TABLE daily_performance (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_fund_allocation_baseline DECIMAL(38, 8) NOT NULL, -- Increased precision for large numbers
    total_fund_allocation_optimized DECIMAL(38, 8) NOT NULL, -- Increased precision for large numbers
    differential DECIMAL(38, 8) NOT NULL, -- Increased precision for large numbers
    differential_percentage DECIMAL(12, 8), -- Percentage gain from optimization
    -- New fields for fund flow tracking (from meeting requirements)
    total_inflows DECIMAL(38, 8) DEFAULT 0, -- Total deposits for the day
    total_outflows DECIMAL(38, 8) DEFAULT 0, -- Total withdrawals for the day
    net_flow DECIMAL(38, 8) DEFAULT 0, -- Inflows - outflows
    previous_day_total DECIMAL(38, 8), -- Previous day total for formula calculation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chain-specific rates and allocations
-- This table stores the individual chain data that feeds into the daily performance calculation
CREATE TABLE chain_rates (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    chain_name chain_name_enum NOT NULL,
    apy_baseline DECIMAL(12, 8) NOT NULL, -- APY rate for baseline scenario
    apy_optimized DECIMAL(12, 8) NOT NULL, -- APY rate for optimized scenario
    allocation_baseline DECIMAL(38, 8) NOT NULL, -- Dollar amount allocated in baseline
    allocation_optimized DECIMAL(38, 8) NOT NULL, -- Dollar amount allocated in optimized
    utilization_ratio DECIMAL(12, 8) NOT NULL, -- AAVE utilization ratio
    total_supply DECIMAL(38, 8) NOT NULL, -- Total supply in AAVE pool (can be very large)
    elasticity_factor DECIMAL(12, 8), -- Elasticity factor for rate calculations
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_chain_date UNIQUE (date, chain_name)
);

-- AAVE pool data from contracts
-- This table stores raw data fetched from AAVE contracts
CREATE TABLE aave_pool_data (
    id SERIAL PRIMARY KEY,
    chain_name chain_name_enum NOT NULL,
    pool_address VARCHAR(42) NOT NULL, -- Ethereum address
    total_liquidity DECIMAL(38, 8) NOT NULL, -- Increased precision for large pool values
    total_borrowed DECIMAL(38, 8) NOT NULL, -- Increased precision for large pool values
    utilization_rate DECIMAL(12, 8) NOT NULL,
    supply_apy DECIMAL(12, 8) NOT NULL,
    variable_borrow_apy DECIMAL(12, 8) NOT NULL,
    stable_borrow_apy DECIMAL(12, 8) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vault data from our contracts
-- This table tracks data from our deployed AAVE vault contracts
CREATE TABLE vault_data (
    id SERIAL PRIMARY KEY,
    chain_name chain_name_enum NOT NULL,
    vault_address VARCHAR(42) NOT NULL, -- Ethereum address
    total_assets DECIMAL(38, 8) NOT NULL, -- Increased precision
    total_shares DECIMAL(38, 8) NOT NULL, -- Increased precision
    amount_invested DECIMAL(38, 8) NOT NULL, -- Increased precision
    share_price DECIMAL(18, 12) NOT NULL, -- High precision for share price
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NEW: Fund flow tracking table (from meeting requirements)
-- This tracks all deposits and withdrawals for calculating net flows
CREATE TABLE fund_flows (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    chain_name chain_name_enum NOT NULL,
    flow_type VARCHAR(10) NOT NULL CHECK (flow_type IN ('deposit', 'withdrawal')),
    amount DECIMAL(38, 8) NOT NULL,
    user_address VARCHAR(42), -- Optional: track which user
    transaction_hash VARCHAR(66), -- Transaction hash for verification
    block_number BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT idx_fund_flows_date_chain UNIQUE (date, chain_name, transaction_hash)
);

-- Rebalancing history
-- This table tracks when rebalancing operations occur
CREATE TABLE rebalancing_history (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    from_chain chain_name_enum NOT NULL,
    to_chain chain_name_enum NOT NULL,
    amount DECIMAL(38, 8) NOT NULL, -- Increased precision
    reason TEXT, -- Why the rebalancing was triggered
    predicted_gain DECIMAL(38, 8), -- Expected gain from this rebalancing
    actual_gain DECIMAL(38, 8), -- Actual gain achieved (filled later)
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    transaction_hash VARCHAR(66), -- Transaction hash if applicable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Configuration table for baseline allocations
-- This stores the initial allocation used for baseline calculations
CREATE TABLE baseline_configuration (
    id SERIAL PRIMARY KEY,
    chain_name chain_name_enum NOT NULL,
    initial_allocation DECIMAL(38, 8) NOT NULL, -- Increased precision
    percentage_allocation DECIMAL(8, 4) NOT NULL, -- Percentage of total fund
    effective_from DATE NOT NULL,
    effective_to DATE, -- NULL means current
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_active_chain UNIQUE (chain_name, effective_to)
);

-- Performance metrics cache
-- Pre-calculated metrics for faster query performance
CREATE TABLE performance_metrics_cache (
    id SERIAL PRIMARY KEY,
    calculation_date DATE NOT NULL,
    total_gain DECIMAL(38, 8) NOT NULL, -- Increased precision
    total_gain_percentage DECIMAL(12, 8) NOT NULL,
    average_daily_gain DECIMAL(38, 8) NOT NULL, -- Increased precision
    average_daily_gain_percentage DECIMAL(12, 8) NOT NULL,
    best_performing_chain chain_name_enum,
    worst_performing_chain chain_name_enum,
    total_days_tracked INTEGER NOT NULL,
    sharpe_ratio DECIMAL(12, 8),
    max_drawdown DECIMAL(12, 8),
    volatility DECIMAL(12, 8),
    -- New fields for fund flow metrics
    total_inflows DECIMAL(38, 8) DEFAULT 0,
    total_outflows DECIMAL(38, 8) DEFAULT 0,
    net_flow DECIMAL(38, 8) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_calculation_date UNIQUE (calculation_date)
);

-- Indexes for better query performance
CREATE INDEX idx_daily_performance_date ON daily_performance(date);
CREATE INDEX idx_chain_rates_date_chain ON chain_rates(date, chain_name);
CREATE INDEX idx_aave_pool_data_chain_timestamp ON aave_pool_data(chain_name, timestamp);
CREATE INDEX idx_vault_data_chain_timestamp ON vault_data(chain_name, timestamp);
CREATE INDEX idx_rebalancing_history_date ON rebalancing_history(date);
CREATE INDEX idx_baseline_configuration_effective ON baseline_configuration(effective_from, effective_to);
CREATE INDEX idx_fund_flows_date ON fund_flows(date);
CREATE INDEX idx_fund_flows_type_date ON fund_flows(flow_type, date);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_daily_performance_updated_at 
    BEFORE UPDATE ON daily_performance 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate daily net flows
CREATE OR REPLACE FUNCTION calculate_daily_net_flow(target_date DATE, target_chain chain_name_enum)
RETURNS DECIMAL(38, 8) AS $$
DECLARE
    total_inflows DECIMAL(38, 8) := 0;
    total_outflows DECIMAL(38, 8) := 0;
BEGIN
    -- Calculate total inflows for the day and chain
    SELECT COALESCE(SUM(amount), 0) INTO total_inflows
    FROM fund_flows 
    WHERE date = target_date 
    AND chain_name = target_chain 
    AND flow_type = 'deposit';
    
    -- Calculate total outflows for the day and chain
    SELECT COALESCE(SUM(amount), 0) INTO total_outflows
    FROM fund_flows 
    WHERE date = target_date 
    AND chain_name = target_chain 
    AND flow_type = 'withdrawal';
    
    RETURN total_inflows - total_outflows;
END;
$$ LANGUAGE plpgsql;

-- Views for common queries

-- Latest performance view
CREATE VIEW latest_performance AS
SELECT 
    dp.*,
    cr.chain_name,
    cr.apy_baseline,
    cr.apy_optimized,
    cr.allocation_baseline,
    cr.allocation_optimized,
    cr.utilization_ratio
FROM daily_performance dp
LEFT JOIN chain_rates cr ON dp.date = cr.date
WHERE dp.date = (SELECT MAX(date) FROM daily_performance);

-- Performance summary view (updated with fund flows)
CREATE VIEW performance_summary AS
SELECT 
    COUNT(*) as total_days,
    SUM(differential) as total_differential,
    AVG(differential) as average_differential,
    MAX(differential) as max_differential,
    MIN(differential) as min_differential,
    STDDEV(differential) as differential_stddev,
    SUM(total_inflows) as total_inflows,
    SUM(total_outflows) as total_outflows,
    SUM(net_flow) as total_net_flow,
    MIN(date) as start_date,
    MAX(date) as end_date
FROM daily_performance;

-- Chain performance comparison view
CREATE VIEW chain_performance_comparison AS
SELECT 
    chain_name,
    COUNT(*) as days_tracked,
    AVG(apy_optimized - apy_baseline) as average_apy_improvement,
    SUM(allocation_optimized - allocation_baseline) as total_allocation_change,
    AVG(utilization_ratio) as average_utilization
FROM chain_rates
GROUP BY chain_name;

-- Fund flow summary view
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

-- Insert initial baseline configuration
INSERT INTO baseline_configuration (chain_name, initial_allocation, percentage_allocation, effective_from) VALUES
('ethereum', 4000000.00, 80.00, '2024-01-01'),
('base', 1000000.00, 20.00, '2024-01-01')
ON CONFLICT (chain_name, effective_to) DO NOTHING; 