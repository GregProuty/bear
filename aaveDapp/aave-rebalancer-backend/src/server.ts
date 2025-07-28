import 'dotenv/config';
import Fastify from 'fastify';
import { ApolloServer } from '@apollo/server';
import fastifyApollo, { fastifyApolloDrainPlugin } from '@as-integrations/fastify';
import { typeDefs } from './schema/typeDefs';
import { resolvers } from './resolvers';
import { createContext } from './context';
import { logger } from './utils/logger';
import { initializeDatabase } from './database/connection';
import { startCronJobs, runDataCollectionManually, runPerformanceCalculationManually, getCronStatus } from './cron';
import { authenticateApiKey } from './middleware/auth';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('Database connection established');

    // Create Fastify instance with CORS support
    const fastify = Fastify({
      logger: false // Use our custom logger instead
    });

    // Register CORS plugin
    await fastify.register(import('@fastify/cors'), {
      origin: [
        'http://localhost:3000', // Local development
        'https://aave-vault-rebalancer.vercel.app', // Vercel deployment
        /\.vercel\.app$/ // Any Vercel preview deployments
      ],
      credentials: true
    });

    // Create Apollo Server
    const apollo = new ApolloServer({
      typeDefs,
      resolvers,
      plugins: [fastifyApolloDrainPlugin(fastify)],
      introspection: NODE_ENV === 'development',
      formatError: (formattedError, error) => {
        logger.error('GraphQL Error:', error);
        return {
          ...formattedError,
          extensions: {
            ...formattedError.extensions,
            code: formattedError.extensions?.code,
          },
        };
      },
    });

    await apollo.start();

    // Register Apollo Server with Fastify  
    await fastify.register(fastifyApollo(apollo), {
      context: async (request: any) => createContext({ request }),
    });

    // Health check endpoint
    fastify.get('/health', async () => {
      return { 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      };
    });

    // Manual cron job trigger endpoints (PROTECTED)
    fastify.post('/trigger/data-collection', {
      preHandler: authenticateApiKey
    }, async (request, reply) => {
      try {
        logger.info('🔧 Manual data collection triggered via API');
        await runDataCollectionManually();
        return { 
          success: true, 
          message: 'Data collection job completed successfully',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        logger.error('Manual data collection failed:', error);
        reply.status(500);
        return { 
          success: false, 
          message: 'Data collection job failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    fastify.post('/trigger/performance-calculation', {
      preHandler: authenticateApiKey
    }, async (request, reply) => {
      try {
        logger.info('🔧 Manual performance calculation triggered via API');
        await runPerformanceCalculationManually();
        return { 
          success: true, 
          message: 'Performance calculation job completed successfully',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        logger.error('Manual performance calculation failed:', error);
        reply.status(500);
        return { 
          success: false, 
          message: 'Performance calculation job failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Migration endpoint to create database tables (PROTECTED)
    fastify.post('/migrate', {
      preHandler: authenticateApiKey
    }, async () => {
      try {
        logger.info('🔧 Database migration triggered via API');
        
        // Import migration function
        const { runMigrations } = await import('./database/connection');
        await runMigrations();
        
        logger.info('✅ Database migration completed successfully');
        return { success: true, message: 'Database migration completed successfully' };
      } catch (error) {
        logger.error('❌ Database migration failed:', error);
        return { success: false, message: 'Database migration failed', error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Cron job status endpoint
    fastify.get('/cron/status', async () => {
      const status = getCronStatus();
      return {
        ...status,
        enabled: process.env.CRON_ENABLED === 'true',
        timestamp: new Date().toISOString()
      };
    });

    // Start the server
    await fastify.listen({ 
      port: PORT, 
      host: NODE_ENV === 'production' ? '0.0.0.0' : 'localhost' 
    });

    logger.info(`🚀 GraphQL server ready at http://localhost:${PORT}/graphql`);
    logger.info(`📊 Health check available at http://localhost:${PORT}/health`);

    // Start cron jobs in production
    if (process.env.CRON_ENABLED === 'true') {
      startCronJobs();
      logger.info('📅 Cron jobs started');
    }

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      try {
        await fastify.close();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer(); 