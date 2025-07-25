# AAVE Rebalancer Backend

GraphQL backend server for tracking AAVE rebalancer performance data. This system collects daily data on AAVE yields across multiple chains, calculates optimal allocations, and tracks performance differentials between baseline and optimized strategies.

## Overview

The AAVE rebalancer aims to optimize net yield by dynamically reallocating funds across AAVE v3 supported chains (Ethereum, Base, Optimism, Arbitrum, Polygon) using an elasticity-based optimization model.

### Key Features

- **Daily Data Collection**: Automated collection of APY rates, utilization ratios, and total supply data from AAVE contracts
- **Performance Tracking**: Comparison between baseline (static) allocation vs optimized rebalancing strategy
- **GraphQL API**: Flexible query interface for frontend applications
- **Real-time Updates**: WebSocket subscriptions for live performance data
- **Multi-chain Support**: Integration with Ethereum, Base, Optimism, Arbitrum, and Polygon

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   GraphQL API   │    │   Database      │
│   (Next.js)     │◄──►│   (Apollo)      │◄──►│  (PostgreSQL)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Cron Jobs     │
                       │                 │
                       │ • Data Fetch    │
                       │ • Performance   │
                       │   Calculation   │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  AAVE Contracts │
                       │  Multi-chain    │
                       └─────────────────┘
```

## Data Model

### Performance Tracking Schema

The system tracks daily performance data with the following structure:

```sql
-- Daily performance snapshots
CREATE TABLE daily_performance (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  total_fund_allocation_baseline DECIMAL NOT NULL,
  total_fund_allocation_optimized DECIMAL NOT NULL,
  differential DECIMAL NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chain-specific rates and allocations
CREATE TABLE chain_rates (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  chain_name VARCHAR(50) NOT NULL,
  apy_baseline DECIMAL NOT NULL,
  apy_optimized DECIMAL NOT NULL,
  utilization_ratio DECIMAL NOT NULL,
  total_supply DECIMAL NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Performance Calculation

The system calculates the differential between baseline and optimized scenarios:

- **Baseline**: Funds remain in initial allocation without rebalancing
- **Optimized**: Funds are reallocated based on elasticity model predictions
- **Differential**: `optimized_value - baseline_value` representing the gain from using the optimizer

## Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Access to Ethereum RPC endpoints for multiple chains

### Setup

1. **Clone and install dependencies**:
```bash
cd aave-rebalancer-backend
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Setup database**:
```bash
npm run db:migrate
npm run db:seed
```

4. **Start development server**:
```bash
npm run dev
```

The GraphQL playground will be available at `http://localhost:4000/graphql`

## API Usage

### Key GraphQL Queries

```graphql
# Get performance data for charting
query GetPerformanceData($startDate: Date!, $endDate: Date!) {
  performanceData(startDate: $startDate, endDate: $endDate) {
    date
    baselineValue
    optimizedValue
    differential
    chains {
      name
      apyBaseline
      apyOptimized
      allocation
    }
  }
}

# Get current allocation data
query GetCurrentAllocation {
  currentAllocation {
    chains {
      name
      apy
      allocation
      totalValue
    }
    totalValue
    lastUpdate
  }
}

# Get performance metrics
query GetPerformanceMetrics {
  performanceMetrics {
    totalGain
    averageDailyGain
    bestPerformingChain
    rebalanceCount
  }
}
```

### Subscriptions

```graphql
# Real-time performance updates
subscription PerformanceUpdates {
  performanceUpdate {
    date
    differential
    chains {
      name
      apy
      allocation
    }
  }
}
```

## Configuration

### Chain Configuration

Add new chains by updating the configuration:

```typescript
export const SUPPORTED_CHAINS = {
  ethereum: {
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    aavePoolAddress: '0x...',
  },
  base: {
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL,
    aavePoolAddress: '0x...',
  },
  // Add more chains...
};
```

### Cron Jobs

The system runs automated data collection:

- **Hourly**: Collect current APY rates and utilization data
- **Daily**: Calculate performance differentials and store historical data
- **Weekly**: Generate performance reports and cleanup old data

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run test suite
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run cron:dev` - Run cron jobs manually for testing

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern=services/aave

# Run with coverage
npm test -- --coverage
```

## Production Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 4000
CMD ["npm", "start"]
```

### Environment Variables

Required production environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV=production`
- Chain RPC URLs for all supported networks
- Contract addresses for deployed AAVE vaults

## Monitoring

The backend includes comprehensive logging and monitoring:

- **Winston Logger**: Structured logging with configurable levels
- **Health Checks**: `/health` endpoint for load balancer monitoring
- **Metrics**: Performance metrics collection for observability
- **Error Tracking**: Automated error reporting and alerting

## Legal Considerations

This system implements aggregated fund tracking to mitigate legal risks:

- **No Individual User Tracking**: All performance calculations are done on aggregated pool data
- **Baseline Comparison**: Performance is measured against a mathematical baseline, not individual user returns
- **Transparent Methodology**: All calculation methods are documented and auditable

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details 