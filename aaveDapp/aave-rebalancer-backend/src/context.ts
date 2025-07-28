import { FastifyRequest } from 'fastify';
import { aaveDataService } from './services/aaveDataService';
import { performanceService } from './services/performanceService';
import { logger } from './utils/logger';
import { requiresAdminAuth, authenticateGraphQLRequest } from './middleware/auth';

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
  // Check if this is an admin operation that requires authentication
  const body = request.body as any;
  const operationName = body?.operationName;
  const query = body?.query;
  
  if (requiresAdminAuth(operationName, query)) {
    const isAuthenticated = authenticateGraphQLRequest(request);
    
    if (!isAuthenticated) {
      // Throw an error that will be caught by GraphQL error handling
      throw new Error('Unauthorized: Admin API key required for this operation. Include X-API-Key header.');
    }
    
    logger.info('GraphQL admin operation authorized', {
      operationName: operationName || 'unknown',
      ip: request.ip
    });
  }

  return {
    aaveDataService,
    performanceService,
    request,
    logger,
    // Add user context here if authentication is implemented
  };
} 