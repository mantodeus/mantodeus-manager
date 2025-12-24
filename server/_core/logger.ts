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
 * - Optional Axiom log aggregation in production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const hasAxiomConfig = !!(process.env.AXIOM_DATASET && process.env.AXIOM_TOKEN);

// Determine transport configuration based on environment
function getTransport() {
  // Development: Use pretty printing
  if (isDevelopment) {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    };
  }

  // Production with Axiom: Send logs to Axiom cloud
  if (hasAxiomConfig) {
    return {
      target: '@axiomhq/pino',
      options: {
        dataset: process.env.AXIOM_DATASET,
        token: process.env.AXIOM_TOKEN,
      },
    };
  }

  // Production without Axiom: Default JSON to stdout
  return undefined;
}

// Create base logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Configure transport based on environment
  transport: getTransport(),

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

// Log the logging configuration on startup
if (isDevelopment) {
  logger.debug('Logger initialized in development mode with pretty printing');
} else if (hasAxiomConfig) {
  logger.info({ dataset: process.env.AXIOM_DATASET }, 'Logger initialized with Axiom log aggregation');
} else {
  logger.info('Logger initialized with JSON output to stdout');
}

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
