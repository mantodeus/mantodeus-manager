import pino from 'pino';
import { randomUUID } from 'crypto';

/**
 * Centralized logging configuration using Pino
 *
 * Features:
 * - Structured JSON logging in production
 * - Pretty-printed logs in development
 * - Request ID tracking
 * - Timestamps and log levels
 * - Context-aware logging
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

// Create base logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Pretty print in development for better readability
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Base configuration
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },

  // Add timestamp to all logs
  timestamp: pino.stdTimeFunctions.isoTime,

  // Redact sensitive information
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
    ],
    remove: true,
  },
});

/**
 * Create a child logger with additional context
 *
 * @example
 * const log = createLogger({ userId: 123 });
 * log.info('User logged in');
 */
export function createLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Create a logger for a specific request
 *
 * @example
 * const log = createRequestLogger(req);
 * log.info('Processing request');
 */
export function createRequestLogger(req: { id?: string; method?: string; url?: string }) {
  return createLogger({
    requestId: req.id || generateRequestId(),
    method: req.method,
    url: req.url,
  });
}

export default logger;
