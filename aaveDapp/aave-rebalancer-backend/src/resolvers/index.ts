import { performanceResolvers } from './performanceResolvers';
import { aaveResolvers } from './aaveResolvers';
import { allocationResolvers } from './allocationResolvers';
import { vaultResolvers } from './vaultResolvers';
import { DateTimeResolver, DateResolver } from 'graphql-scalars';

// Custom scalar for Decimal type
const DecimalResolver = {
  serialize: (value: any) => parseFloat(value),
  parseValue: (value: any) => parseFloat(value),
  parseLiteral: (ast: any) => parseFloat(ast.value)
};

export const resolvers = {
  // Scalar resolvers
  Date: DateResolver,
  DateTime: DateTimeResolver,
  Decimal: DecimalResolver,

  // Query resolvers
  Query: {
    ...performanceResolvers.Query,
    ...aaveResolvers.Query,
    ...allocationResolvers.Query,
    ...vaultResolvers.Query,
  },

  // Mutation resolvers
  Mutation: {
    ...performanceResolvers.Mutation,
    ...aaveResolvers.Mutation,
    ...vaultResolvers.Mutation,
  },

  // Subscription resolvers
  Subscription: {
    ...performanceResolvers.Subscription,
    ...allocationResolvers.Subscription,
  },

  // Type resolvers
  DailyPerformance: {
    ...performanceResolvers.DailyPerformance,
  },

  ChainPerformance: {
    ...performanceResolvers.ChainPerformance,
  },

  AllocationData: {
    ...allocationResolvers.AllocationData,
  },

  AavePoolData: {
    ...aaveResolvers.AavePoolData,
  },

  ChainData: {
    ...aaveResolvers.ChainData,
  },

  VaultData: {
    ...vaultResolvers.VaultData,
  }
}; 