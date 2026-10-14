/**
 * Studio Maya Structured Logger & Production Error Monitoring Bridge
 * 
 * Provides structured JSON logging in production and readable formatting in development,
 * with automatic redaction of sensitive credentials, tokens, and payment secrets.
 * Delivers real exceptions directly to Sentry (via HTTP Store API or SDK) and webhook monitors.
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

/**
 * Parses Sentry DSN into endpoint components.
 * Format: https://<publicKey>@<host>/<projectId>
 */
export function parseSentryDsn(dsn: string): { host: string; projectId: string; publicKey: string } | null {
  try {
    const parsed = new URL(dsn);
    const publicKey = parsed.username;
    const host = parsed.host;
    const projectId = parsed.pathname.replace(/^\/+/, '');

    if (!publicKey || !host || !projectId) {
      return null;
    }

    return { host, projectId, publicKey };
  } catch {
    return null;
  }
}

/**
 * Dispatches an exception to Sentry via HTTP Store API.
 */
export async function sendExceptionToSentry(
  err: Error | unknown,
  context?: Record<string, unknown>,
  dsnOverride?: string
): Promise<{ success: boolean; error?: string }> {
  const dsn = dsnOverride || process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return { success: false, error: 'SENTRY_DSN is not configured.' };
  }

  const parsedDsn = parseSentryDsn(dsn);
  if (!parsedDsn) {
    return { success: false, error: 'Invalid SENTRY_DSN format.' };
  }

  const errorObj = err instanceof Error ? err : new Error(String(err));
  const payload = {
    event_id: Math.random().toString(36).substring(2) + Date.now().toString(36),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    logger: 'studiomaya.production',
    environment: process.env.NODE_ENV || 'development',
    exception: {
      values: [
        {
          type: errorObj.name,
          value: errorObj.message,
          stacktrace: {
            frames: (errorObj.stack || '')
              .split('\n')
              .slice(1)
              .map((line) => ({ function: line.trim() })),
          },
        },
      ],
    },
    extra: redactSensitiveData(context),
  };

  try {
    const response = await fetch(`https://${parsedDsn.host}/api/${parsedDsn.projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=studiomaya-logger/1.0, sentry_key=${parsedDsn.publicKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      return { success: true };
    }
    return { success: false, error: `Sentry returned HTTP status ${response.status}` };
  } catch (netErr) {
    return { success: false, error: String(netErr) };
  }
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
      const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
      if (dsn) {
        // Asynchronously deliver to Sentry without blocking
        sendExceptionToSentry(err, context as Record<string, unknown>).catch(() => {});
      }

      // Check for generic monitoring webhook (Discord, Slack, Axiom)
      const webhookUrl = process.env.MONITORING_WEBHOOK_URL;
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'error',
            message: err instanceof Error ? err.message : String(err),
            context: redactSensitiveData(context),
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(2000),
        }).catch(() => {});
      }
    } catch {
      // Never throw from the logger
    }
  }
}

export const logger = new Logger();
