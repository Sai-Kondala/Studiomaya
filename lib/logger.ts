/**
 * Studio Maya Structured Logger & Error Monitoring Bridge
 * 
 * Provides structured JSON logging in production and readable formatting in development,
 * with automatic redaction of sensitive credentials, tokens, and payment secrets.
 * Seamlessly hooks into Sentry if configured, without throwing or interrupting runtime execution.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key_secret',
  'razorpay_key_secret',
  'supabase_service_role_key',
  'authorization',
  'cookie',
  'credit_card',
  'cvv',
  'token_hash',
]);

/**
 * Recursively redacts sensitive values from log metadata objects.
 */
export function redactSensitiveData(data: unknown, depth = 0): unknown {
  if (depth > 5) return '[Truncated]';
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = Array.from(SENSITIVE_KEYS).some(
      (sensitive) => lowerKey.includes(sensitive)
    );

    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';

  private formatMessage(level: LogLevel, message: string, context?: unknown, err?: unknown): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context !== undefined) {
      entry.context = redactSensitiveData(context);
    }

    if (err instanceof Error) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    } else if (err !== undefined && err !== null) {
      entry.error = {
        name: 'UnknownError',
        message: String(err),
      };
    }

    return entry;
  }

  private output(level: LogLevel, entry: LogEntry) {
    if (this.isProduction) {
      const jsonString = JSON.stringify(entry);
      if (level === 'error') {
        console.error(jsonString);
      } else if (level === 'warn') {
        console.warn(jsonString);
      } else {
        console.log(jsonString);
      }
    } else {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] ${entry.message}`;
      if (level === 'error') {
        console.error(prefix, entry.context || '', entry.error || '');
      } else if (level === 'warn') {
        console.warn(prefix, entry.context || '');
      } else {
        console.log(prefix, entry.context || '');
      }
    }
  }

  debug(message: string, context?: unknown) {
    if (!this.isProduction || process.env.LOG_LEVEL === 'debug') {
      const entry = this.formatMessage('debug', message, context);
      this.output('debug', entry);
    }
  }

  info(message: string, context?: unknown) {
    const entry = this.formatMessage('info', message, context);
    this.output('info', entry);
  }

  warn(message: string, context?: unknown) {
    const entry = this.formatMessage('warn', message, context);
    this.output('warn', entry);
  }

  error(message: string, err?: unknown, context?: unknown) {
    const entry = this.formatMessage('error', message, context, err);
    this.output('error', entry);
    this.forwardToMonitoring(err || message, context);
  }

  /**
   * Forwards critical errors to external APM (e.g., Sentry) if present,
   * without interrupting application control flow.
   */
  captureException(err: unknown, context?: Record<string, unknown>) {
    this.error(err instanceof Error ? err.message : String(err), err, context);
  }

  private forwardToMonitoring(err: unknown, context?: unknown) {
    try {
      // Optional Sentry dynamic dispatch if Sentry is configured
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globalAny = global as any;
      if (globalAny.Sentry && typeof globalAny.Sentry.captureException === 'function') {
        globalAny.Sentry.captureException(err, { extra: redactSensitiveData(context) });
      }
    } catch {
      // Never throw from the logger
    }
  }
}

export const logger = new Logger();
