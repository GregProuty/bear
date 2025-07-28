import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';

/**
 * API Key authentication middleware for admin endpoints
 */
export const authenticateApiKey = async (request: FastifyRequest, reply: FastifyReply) => {
  // Debug: Log that middleware is being called
  logger.info('🔒 Authentication middleware called', { 
    url: request.url, 
    method: request.method,
    hasApiKey: !!request.headers['x-api-key'],
    hasAdminKey: !!process.env.ADMIN_API_KEY
  });
  
  try {
    const apiKey = request.headers['x-api-key'] as string;
    const adminApiKey = process.env.ADMIN_API_KEY;

    // Check if API key is configured
    if (!adminApiKey) {
      logger.error('ADMIN_API_KEY not configured in environment variables');
      throw new Error('Authentication system not properly configured');
    }

    // Check if API key is provided
    if (!apiKey) {
      logger.warn('Admin endpoint access attempted without API key', {
        ip: request.ip,
        url: request.url,
        userAgent: request.headers['user-agent']
      });
      
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'API key required. Include X-API-Key header.'
      });
      return reply; // Return the reply to stop execution
    }

    // Validate API key
    if (apiKey !== adminApiKey) {
      logger.warn('Admin endpoint access attempted with invalid API key', {
        ip: request.ip,
        url: request.url,
        providedKey: apiKey.substring(0, 8) + '...', // Log only first 8 chars
        userAgent: request.headers['user-agent']
      });
      
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
      return reply; // Return the reply to stop execution
    }

    // Success - log access and continue
    logger.info('Admin endpoint access authorized', {
      ip: request.ip,
      url: request.url,
      userAgent: request.headers['user-agent']
    });
    
    // Explicitly continue to the handler
    return;

  } catch (error) {
    logger.error('Error in API key authentication:', error);
    reply.code(500).send({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
    return reply; // Stop execution on error
  }
};

/**
 * Check if GraphQL operation requires admin authentication
 */
export const requiresAdminAuth = (operationName?: string, query?: string): boolean => {
  if (!operationName && !query) return false;

  // List of admin-only operations
  const adminOperations = [
    'collectAaveData',
    'collectVaultData', 
    'calculatePerformance',
    'debugEthereum',
    'testElasticityModel',
    'updateBaselineAllocation'
  ];

  // Check by operation name
  if (operationName && adminOperations.includes(operationName)) {
    return true;
  }

  // Check by query content (fallback)
  if (query) {
    const hasAdminMutation = adminOperations.some(op => 
      query.includes(op)
    );
    return hasAdminMutation;
  }

  return false;
};

/**
 * GraphQL authentication helper
 */
export const authenticateGraphQLRequest = (request: FastifyRequest): boolean => {
  const apiKey = request.headers['x-api-key'] as string;
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    logger.error('ADMIN_API_KEY not configured for GraphQL authentication');
    return false;
  }

  if (!apiKey || apiKey !== adminApiKey) {
    logger.warn('GraphQL admin operation attempted with invalid/missing API key', {
      ip: request.ip,
      providedKey: apiKey ? apiKey.substring(0, 8) + '...' : 'none',
      userAgent: request.headers['user-agent']
    });
    return false;
  }

  return true;
}; 