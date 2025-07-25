import { performanceService } from '../services/performanceService';
import { GraphQLContext } from '../context';

export const performanceResolvers = {
  Query: {
    performanceData: async (
      _: any,
      { startDate, endDate }: { startDate: string; endDate: string },
      { logger }: GraphQLContext
    ) => {
      try {
        logger.info(`Fetching performance data from ${startDate} to ${endDate}`);
        return await performanceService.getPerformanceData(startDate, endDate);
      } catch (error) {
        logger.error('Error fetching performance data:', error);
        throw error;
      }
    },

    performanceMetrics: async (_: any, __: any, { logger }: GraphQLContext) => {
      try {
        logger.info('Fetching performance metrics');
        return await performanceService.getPerformanceMetrics();
      } catch (error) {
        logger.error('Error fetching performance metrics:', error);
        throw error;
      }
    },

    historicalPerformance: async (
      _: any,
      { days = 30 }: { days?: number },
      { logger }: GraphQLContext
    ) => {
      try {
        const endDate = new Date().toISOString().split('T')[0]!;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0]!;
        
        logger.info(`Fetching ${days} days of historical performance`);
        return await performanceService.getPerformanceData(startDate, endDate);
      } catch (error) {
        logger.error('Error fetching historical performance:', error);
        throw error;
      }
    },

    performanceSummary: async (
      _: any,
      { startDate, endDate }: { startDate: string; endDate: string },
      { logger }: GraphQLContext
    ) => {
      try {
        logger.info(`Generating performance summary from ${startDate} to ${endDate}`);
        const performanceData = await performanceService.getPerformanceData(startDate, endDate);
        
        if (performanceData.length === 0) {
          throw new Error('No performance data found for the specified date range');
        }

        const totalDifferential = performanceData.reduce(
          (sum, day) => sum + parseFloat(day.differential), 0
        );
        
        const averageDifferential = totalDifferential / performanceData.length;
        
        const bestDay = performanceData.reduce((best, day) => 
          parseFloat(day.differential) > parseFloat(best.differential) ? day : best
        );
        
        const worstDay = performanceData.reduce((worst, day) => 
          parseFloat(day.differential) < parseFloat(worst.differential) ? day : worst
        );

        // Calculate consistency score (inverse of coefficient of variation)
        const variance = performanceData.reduce(
          (sum, day) => sum + Math.pow(parseFloat(day.differential) - averageDifferential, 2), 0
        ) / performanceData.length;
        
        const standardDeviation = Math.sqrt(variance);
        const consistencyScore = averageDifferential !== 0 
          ? Math.max(0, 100 - (standardDeviation / Math.abs(averageDifferential)) * 100)
          : 100;

        // Generate performance chart data
        let cumulativeDifferential = 0;
        const performanceChart = performanceData.map(day => {
          cumulativeDifferential += parseFloat(day.differential);
          return {
            date: day.date,
            baselineValue: day.totalFundAllocationBaseline,
            optimizedValue: day.totalFundAllocationOptimized,
            cumulativeDifferential: cumulativeDifferential.toString()
          };
        });

        return {
          startDate,
          endDate,
          totalDifferential: totalDifferential.toString(),
          averageDifferential: averageDifferential.toString(),
          bestDay,
          worstDay,
          consistencyScore,
          performanceChart
        };
      } catch (error) {
        logger.error('Error generating performance summary:', error);
        throw error;
      }
    }
  },

  Mutation: {
    calculatePerformance: async (
      _: any,
      { date }: { date: string },
      { logger }: GraphQLContext
    ) => {
      try {
        logger.info(`Manual performance calculation triggered for ${date}`);
        const result = await performanceService.calculateDailyPerformance(date);
        
        if (!result) {
          throw new Error('Failed to calculate performance - no data available');
        }
        
        return result;
      } catch (error) {
        logger.error('Error in manual performance calculation:', error);
        throw error;
      }
    }
  },

  Subscription: {
    performanceUpdate: {
      // This would be implemented with a real-time subscription system
      // For now, returning a placeholder
      subscribe: async function* () {
        // In production, this would use Redis/WebSockets for real-time updates
        yield { performanceUpdate: null };
      }
    }
  },

  DailyPerformance: {
    // Field resolvers can be added here if needed for complex calculations
  },

  ChainPerformance: {
    // Field resolvers can be added here if needed
  }
}; 