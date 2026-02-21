import { FrameworkMeta } from 'filamentjs';

/**
 * Application metadata interface
 * 
 * Extend this interface to add your own metadata properties.
 * Middleware can inspect req.endpointMeta to make decisions.
 */
export interface AppMeta extends FrameworkMeta {
  /**
   * Whether this endpoint requires authentication
   */
  requiresAuth: boolean;

  /**
   * Required role for this endpoint
   */
  role?: 'admin' | 'user';

  /**
   * Whether this endpoint requires a session
   */
  requiresSession: boolean;

  /**
   * Rate limit for this endpoint (requests per minute)
   */
  rateLimit: number;

  /**
   * Logging configuration
   */
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };

  /**
   * Tags for categorizing endpoints
   */
  tags: string[];

  /**
   * OpenAPI documentation
   */
  openapi?: {
    summary: string;
    description?: string;
    tags?: string[];
  };
}
