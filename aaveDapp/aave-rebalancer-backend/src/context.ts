import { FastifyRequest } from 'fastify';
import { aaveDataService } from './services/aaveDataService';
import { performanceService } from './services/performanceService';
import { logger } from './utils/logger';

export interface GraphQLContext {
  // Services
  aaveDataService: typeof aaveDataService;
  performanceService: typeof performanceService;
  
  // Request context
  request: FastifyRequest;
  
  // Utilities
  logger: typeof logger;
  
  // User context (if authentication is added later)
  user?: {
    id: string;
    role: string;
  };
}

export async function createContext({ request }: { request: FastifyRequest }): Promise<GraphQLContext> {
  return {
    aaveDataService,
    performanceService,
    request,
    logger,
    // Add user context here if authentication is implemented
  };
} 