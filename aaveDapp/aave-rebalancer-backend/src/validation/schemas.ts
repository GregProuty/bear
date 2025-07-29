import { z } from 'zod';

// Common validation helpers
const DateString = z.string().refine(
  (date) => !isNaN(Date.parse(date)),
  { message: 'Invalid date format. Use YYYY-MM-DD or ISO format' }
);

const ChainName = z.enum(['ethereum', 'base', 'optimism', 'arbitrum', 'polygon', 'arbitrumSepolia', 'optimismSepolia'], {
  errorMap: () => ({ message: 'Invalid chain name. Must be one of: ethereum, base, optimism, arbitrum, polygon, arbitrumSepolia, optimismSepolia' })
});

const PositiveNumber = z.number().positive('Must be a positive number');
const NonNegativeNumber = z.number().nonnegative('Must be a non-negative number');
const Percentage = z.number().min(0, 'Percentage must be >= 0').max(100, 'Percentage must be <= 100');

const EthereumAddress = z.string().regex(
  /^0x[a-fA-F0-9]{40}$/,
  'Invalid Ethereum address format'
);

const Decimal = z.union([
  z.string().refine(
    (val) => !isNaN(parseFloat(val)) && isFinite(parseFloat(val)),
    'Invalid decimal format'
  ),
  z.number()
]).transform((val) => typeof val === 'string' ? parseFloat(val) : val);

// GraphQL Query Schemas
export const PerformanceDataSchema = z.object({
  startDate: DateString,
  endDate: DateString
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date', path: ['startDate'] }
);

export const HistoricalPerformanceSchema = z.object({
  days: z.number().int().min(1, 'Days must be at least 1').max(365, 'Days cannot exceed 365').optional().default(30)
});

export const ChainRatesSchema = z.object({
  chainName: ChainName.optional(),
  date: DateString.optional()
});

export const AavePoolDataSchema = z.object({
  chainName: ChainName
});

export const VaultDataSchema = z.object({
  chainName: ChainName
});

export const HistoricalVaultDataSchema = z.object({
  chainName: ChainName,
  days: z.number().int().min(1).max(365).optional().default(30)
});

export const SharePriceHistorySchema = z.object({
  chainName: ChainName,
  days: z.number().int().min(1).max(365).optional().default(30)
});

// GraphQL Mutation Schemas
export const BaselineAllocationSchema = z.object({
  ethereum: Decimal.refine(val => val >= 0, 'Ethereum allocation must be non-negative'),
  base: Decimal.refine(val => val >= 0, 'Base allocation must be non-negative'),
  optimism: Decimal.refine(val => val >= 0, 'Optimism allocation must be non-negative').optional(),
  arbitrum: Decimal.refine(val => val >= 0, 'Arbitrum allocation must be non-negative').optional(),
  polygon: Decimal.refine(val => val >= 0, 'Polygon allocation must be non-negative').optional()
}).refine((data) => {
  const total = data.ethereum + data.base + (data.optimism || 0) + (data.arbitrum || 0) + (data.polygon || 0);
  return Math.abs(total - 100) < 0.01; // Allow for small floating point errors
}, {
  message: 'Total allocation must equal 100%',
  path: ['ethereum'] // Point to the first field for error display
});

export const CalculatePerformanceSchema = z.object({
  date: DateString.refine(
    (date) => new Date(date) <= new Date(),
    'Date cannot be in the future'
  )
});

// REST API Schemas
export const ApiKeyHeaderSchema = z.object({
  'x-api-key': z.string().min(1, 'API key is required')
});

export const TriggerEndpointSchema = z.object({
  force: z.boolean().optional().default(false)
});

// Input validation for AAVE data
export const AaveDataInputSchema = z.object({
  poolAddress: EthereumAddress,
  totalLiquidity: Decimal.refine(val => val >= 0, 'Total liquidity must be non-negative'),
  totalBorrowed: Decimal.refine(val => val >= 0, 'Total borrowed must be non-negative'),
  utilizationRate: Percentage,
  supplyAPY: NonNegativeNumber,
  variableBorrowAPY: NonNegativeNumber,
  stableBorrowAPY: NonNegativeNumber
});

// Vault data validation
export const VaultDataInputSchema = z.object({
  vaultAddress: EthereumAddress,
  totalAssets: Decimal.refine(val => val >= 0, 'Total assets must be non-negative'),
  totalShares: Decimal.refine(val => val >= 0, 'Total shares must be non-negative'),
  sharePrice: NonNegativeNumber,
  assetDecimals: z.number().int().min(0).max(18, 'Asset decimals must be between 0 and 18'),
  shareDecimals: z.number().int().min(0).max(18, 'Share decimals must be between 0 and 18')
});

// Performance data validation
export const PerformanceDataInputSchema = z.object({
  date: DateString,
  totalFundAllocationBaseline: Decimal,
  totalFundAllocationOptimized: Decimal,
  differential: Decimal,
  differentialPercentage: z.number(),
  chains: z.array(z.object({
    chainName: ChainName,
    apyBaseline: NonNegativeNumber,
    apyOptimized: NonNegativeNumber,
    allocationBaseline: Decimal.refine(val => val >= 0),
    allocationOptimized: Decimal.refine(val => val >= 0),
    utilizationRatio: Percentage,
    totalSupply: Decimal.refine(val => val >= 0)
  }))
});

// Subscription schemas
export const SubscriptionInputSchema = z.object({
  chainName: ChainName.optional()
});

// Environment variable validation
export const EnvSchema = z.object({
  DATABASE_URL: z.string().url('Invalid database URL'),
  ADMIN_API_KEY: z.string().min(32, 'Admin API key must be at least 32 characters'),
  PORT: z.string().regex(/^\d+$/).transform(Number).optional().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  ETHEREUM_RPC_URL: z.string().url('Invalid Ethereum RPC URL').optional(),
  BASE_RPC_URL: z.string().url('Invalid Base RPC URL').optional(),
  OPTIMISM_RPC_URL: z.string().url('Invalid Optimism RPC URL').optional(),
  ARBITRUM_RPC_URL: z.string().url('Invalid Arbitrum RPC URL').optional(),
  POLYGON_RPC_URL: z.string().url('Invalid Polygon RPC URL').optional(),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url('Invalid Arbitrum Sepolia RPC URL').optional(),
  OPTIMISM_SEPOLIA_RPC_URL: z.string().url('Invalid Optimism Sepolia RPC URL').optional()
});

// Type exports for TypeScript
export type PerformanceDataInput = z.infer<typeof PerformanceDataSchema>;
export type BaselineAllocationInput = z.infer<typeof BaselineAllocationSchema>;
export type AaveDataInput = z.infer<typeof AaveDataInputSchema>;
export type VaultDataInput = z.infer<typeof VaultDataInputSchema>;
export type PerformanceDataInputType = z.infer<typeof PerformanceDataInputSchema>;
export type ChainNameType = z.infer<typeof ChainName>;
export type EnvConfig = z.infer<typeof EnvSchema>; 