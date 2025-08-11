import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar Date
  scalar DateTime
  scalar Decimal

  type Query {
    # Performance tracking queries
    performanceData(startDate: Date!, endDate: Date!): [DailyPerformance!]!
    currentAllocation: AllocationData!
    performanceMetrics: PerformanceMetrics!
    chainRates(chainName: String, date: Date): [ChainRate!]!
    
    # Historical data queries
    historicalPerformance(days: Int = 30): [DailyPerformance!]!
    performanceSummary(startDate: Date!, endDate: Date!): PerformanceSummary!
    
    # Activity feed queries
    recentActivity(limit: Int = 20): [ActivityEntry!]!
    fundFlows(days: Int = 7): [FundFlow!]!
    rebalancingHistory(days: Int = 7): [RebalancingEvent!]!
    
    # AAVE data queries
    aavePoolData(chainName: String!): AavePoolData
    allChainData: [ChainData!]!
    
    # Vault data queries
    vaultData(chainName: String!): VaultData
    allVaultData: [VaultData!]!
    historicalVaultData(chainName: String!, days: Int = 30): [VaultData!]!
    sharePriceHistory(chainName: String!, days: Int = 30): [SharePricePoint!]!
  }

  type Mutation {
    # Manual data collection triggers (for admin use)
    collectAaveData: Boolean!
    collectVaultData: Boolean!
    calculatePerformance(date: Date!): DailyPerformance!
    
    # Debug endpoints
    debugEthereum: DebugResult!
    testElasticityModel: ElasticityTestResult!
    
    # Configuration updates
    updateBaselineAllocation(allocation: BaselineAllocationInput!): Boolean!
  }

  type Subscription {
    # Real-time updates
    performanceUpdate: DailyPerformance!
    allocationUpdate: AllocationData!
    aaveDataUpdate(chainName: String): ChainData!
  }

  # Core performance tracking types
  type DailyPerformance {
    id: ID!
    date: Date!
    totalFundAllocationBaseline: Decimal!
    totalFundAllocationOptimized: Decimal!
    differential: Decimal!
    differentialPercentage: Float!
    chains: [ChainPerformance!]!
    createdAt: DateTime!
  }

  type ChainPerformance {
    chainName: String!
    apyBaseline: Float!
    apyOptimized: Float!
    allocationBaseline: Decimal!
    allocationOptimized: Decimal!
    utilizationRatio: Float!
    totalSupply: Decimal!
  }

  type AllocationData {
    chains: [AllocationChain!]!
    totalValue: Decimal!
    lastUpdate: DateTime!
  }

  type AllocationChain {
    name: String!
    apy: Float!
    allocation: Float!
    totalValue: Decimal!
    color: String!
    icon: String!
  }

  type PerformanceMetrics {
    totalGain: Decimal!
    totalGainPercentage: Float!
    averageDailyGain: Decimal!
    averageDailyGainPercentage: Float!
    bestPerformingChain: String!
    worstPerformingChain: String!
    rebalanceCount: Int!
    totalDaysTracked: Int!
    sharpeRatio: Float
    maxDrawdown: Float
    volatility: Float
  }

  type ChainRate {
    id: ID!
    date: Date!
    chainName: String!
    apyBaseline: Float!
    apyOptimized: Float!
    utilizationRatio: Float!
    totalSupply: Decimal!
    elasticityFactor: Float!
    createdAt: DateTime!
  }

  type PerformanceSummary {
    startDate: Date!
    endDate: Date!
    totalDifferential: Decimal!
    averageDifferential: Decimal!
    bestDay: DailyPerformance!
    worstDay: DailyPerformance!
    consistencyScore: Float!
    performanceChart: [PerformanceChartPoint!]!
  }

  type PerformanceChartPoint {
    date: Date!
    baselineValue: Decimal!
    optimizedValue: Decimal!
    cumulativeDifferential: Decimal!
  }

  # AAVE integration types
  type AavePoolData {
    chainName: String!
    poolAddress: String!
    totalLiquidity: Decimal!
    totalBorrowed: Decimal!
    utilizationRate: Float!
    supplyAPY: Float!
    variableBorrowAPY: Float!
    stableBorrowAPY: Float!
    lastUpdate: DateTime!
  }

  type ChainData {
    chainName: String!
    chainId: Int!
    aavePool: AavePoolData!
    vaultAddress: String
    totalDeposited: Decimal!
    activeUsers: Int!
    lastRebalance: DateTime
  }

  # Input types
  input BaselineAllocationInput {
    ethereum: Decimal!
    base: Decimal!
    optimism: Decimal
    arbitrum: Decimal
    polygon: Decimal
  }

  input DateRangeInput {
    startDate: Date!
    endDate: Date!
  }

  # Enums
  enum ChainName {
    ETHEREUM
    BASE
    OPTIMISM
    ARBITRUM
    POLYGON
  }

  enum TimePeriod {
    DAY
    WEEK
    MONTH
    QUARTER
    YEAR
  }

  enum SortOrder {
    ASC
    DESC
  }

  # Debug types
  type DebugResult {
    ethereumConnected: Boolean!
    baseConnected: Boolean!
    ethereumData: Boolean!
    baseData: Boolean!
    timestamp: String!
  }

  type ElasticityTestResult {
    success: Boolean!
    error: String
    timestamp: String!
  }

  # Vault data types
  type VaultData {
    chainName: String!
    vaultAddress: String!
    totalAssets: Decimal!
    totalShares: Decimal!
    sharePrice: Float!
    assetDecimals: Int!
    shareDecimals: Int!
    lastUpdate: DateTime!
    
    # Computed fields
    sharePriceFormatted: String!
    totalAssetsUSD: String!
    performance24h: Float!
  }

  type SharePricePoint {
    date: Date!
    sharePrice: Float!
    minSharePrice: Float!
    maxSharePrice: Float!
    dataPoints: Int!
  }

  # Activity feed types
  type ActivityEntry {
    id: ID!
    type: ActivityType!
    title: String!
    description: String!
    amount: Decimal
    chainName: String
    userAddress: String
    transactionHash: String
    timestamp: DateTime!
    icon: String!
  }

  type FundFlow {
    id: ID!
    date: Date!
    chainName: String!
    flowType: FlowType!
    amount: Decimal!
    userAddress: String
    transactionHash: String
    blockNumber: Int
    timestamp: DateTime!
  }

  type RebalancingEvent {
    id: ID!
    date: Date!
    fromChain: String!
    toChain: String!
    amount: Decimal!
    reason: String
    predictedGain: Decimal
    actualGain: Decimal
    timestamp: DateTime!
    transactionHash: String
  }

  enum ActivityType {
    DEPOSIT
    WITHDRAWAL
    REBALANCE
    HARVEST
    ALLOCATION
  }

  enum FlowType {
    DEPOSIT
    WITHDRAWAL
  }
`; 