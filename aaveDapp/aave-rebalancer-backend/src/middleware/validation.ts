import { z } from 'zod';
import { FastifyRequest, FastifyReply } from 'fastify';
import { GraphQLFieldResolver } from 'graphql';
import { GraphQLContext } from '../context';
import { logger } from '../utils/logger';
import { ApiKeyHeaderSchema } from '../validation/schemas';

// GraphQL resolver validation wrapper
export function validateGraphQLInput<T extends z.ZodSchema>(schema: T) {
  return function (resolver: GraphQLFieldResolver<any, GraphQLContext, any>) {
    return async (parent: any, args: any, context: GraphQLContext, info: any) => {
      try {
        // Validate the input arguments
        const validatedArgs = schema.parse(args);
        
        // Call the original resolver with validated arguments
        return await resolver(parent, validatedArgs, context, info);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formattedErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }));
          
          context.logger.warn('GraphQL input validation failed:', {
            query: info.fieldName,
            errors: formattedErrors,
            input: args
          });
          
          throw new Error(`Validation failed: ${formattedErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
        }
        throw error;
      }
    };
  };
}

// REST API validation middleware
export function validateRestInput<T extends z.ZodSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' | 'headers' = 'body'
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      let dataToValidate;
      
      switch (source) {
        case 'body':
          dataToValidate = request.body;
          break;
        case 'query':
          dataToValidate = request.query;
          break;
        case 'params':
          dataToValidate = request.params;
          break;
        case 'headers':
          dataToValidate = request.headers;
          break;
      }
      
      const validatedData = schema.parse(dataToValidate);
      
      // Attach validated data to request for use in handlers
      (request as any).validatedData = validatedData;
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        logger.warn('REST API input validation failed:', {
          endpoint: request.url,
          method: request.method,
          source,
          errors: formattedErrors,
          ip: request.ip
        });
        
        reply.code(400).send({
          error: 'Validation Error',
          message: 'Invalid input data',
          details: formattedErrors
        });
        return;
      }
      
      logger.error('Unexpected validation error:', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during validation'
      });
      return;
    }
  };
}

// Admin endpoint validation (combines API key + input validation)
export function validateAdminEndpoint<T extends z.ZodSchema>(
  inputSchema?: T,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return [
    validateRestInput(ApiKeyHeaderSchema, 'headers'),
    ...(inputSchema ? [validateRestInput(inputSchema, source)] : [])
  ];
}

// GraphQL admin mutation validation
export function validateAdminMutation<T extends z.ZodSchema>(schema: T) {
  return function (resolver: GraphQLFieldResolver<any, GraphQLContext, any>) {
    return async (parent: any, args: any, context: GraphQLContext, info: any) => {
      try {
        // Check for admin API key in headers
        const apiKey = context.request?.headers?.['x-api-key'];
        const adminApiKey = process.env.ADMIN_API_KEY;
        
        if (!adminApiKey) {
          throw new Error('Authentication system not properly configured');
        }
        
        if (!apiKey || apiKey !== adminApiKey) {
          context.logger.warn('Unauthorized admin mutation attempt:', {
            mutation: info.fieldName,
            ip: context.request?.ip,
            hasApiKey: !!apiKey
          });
          
          throw new Error('Unauthorized: Admin API key required for this operation. Include X-API-Key header.');
        }
        
        // Validate input arguments
        const validatedArgs = schema.parse(args);
        
        context.logger.info('Admin mutation authorized:', {
          mutation: info.fieldName,
          ip: context.request?.ip
        });
        
        // Call the original resolver with validated arguments
        return await resolver(parent, validatedArgs, context, info);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formattedErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }));
          
          context.logger.warn('Admin mutation validation failed:', {
            mutation: info.fieldName,
            errors: formattedErrors,
            input: args
          });
          
          throw new Error(`Validation failed: ${formattedErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`);
        }
        throw error;
      }
    };
  };
}

// Utility function to format validation errors consistently
export function formatValidationError(error: z.ZodError): string {
  return error.errors
    .map(err => `${err.path.join('.')}: ${err.message}`)
    .join(', ');
}

// Environment variable validation on startup
export function validateEnvironment<T extends z.ZodSchema>(schema: T): z.infer<T> {
  try {
    return schema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');
      
      logger.error('Environment validation failed:', formattedErrors);
      throw new Error(`Invalid environment configuration:\n${formattedErrors}`);
    }
    throw error;
  }
}

// Type helpers for TypeScript
export type ValidatedRequest<T> = FastifyRequest & {
  validatedData: T;
};

export type ValidationResult<T extends z.ZodSchema> = {
  success: true;
  data: z.infer<T>;
} | {
  success: false;
  errors: z.ZodError['errors'];
};

// Safe validation helper that doesn't throw
export function safeValidate<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors };
    }
    throw error;
  }
} 