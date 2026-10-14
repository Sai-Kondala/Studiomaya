import { NextResponse } from 'next/server';

export interface RateLimitOptions {
  limit?: number; // max requests allowed per window
  windowMs?: number; // window duration in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  source?: 'memory' | 'upstash' | 'test';
}

interface WindowRecord {
  timestamps: number[];
  lastCleanup: number;
}

// In-memory sliding window fallback store
const memoryStore = new Map<string, WindowRecord>();

/**
 * Resets the in-memory rate limit store (primarily for unit testing).
 */
export function clearRateLimitStore(): void {
  memoryStore.clear();
}

/**
 * Extracts client IP safely from request headers across various edge/reverse proxy environments.
 * Prioritizes trusted edge headers (Cloudflare, Vercel, Real-IP) before fallback to X-Forwarded-For.
 */
export function getClientIp(req: Request): string {
  // 1. Cloudflare verified client IP (overwritten and validated at Cloudflare edge)
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }

  // 2. Vercel edge client IP
  const vercelIp = req.headers.get('x-vercel-ip');
  if (vercelIp && vercelIp.trim()) {
    return vercelIp.trim();
  }

  // 3. Direct reverse proxy client IP
  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  // 4. Standard X-Forwarded-For: extract first valid IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  return '127.0.0.1';
}

/**
 * In-memory sliding window check.
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 20;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const windowStart = now - windowMs;

  // Periodic memory store cleanup: prune expired records
  if (memoryStore.size > 1000) {
    for (const [key, item] of memoryStore.entries()) {
      if (item.timestamps.length === 0 || now - item.lastCleanup > windowMs) {
        memoryStore.delete(key);
      }
    }
  }

  let record = memoryStore.get(identifier);
  if (!record) {
    record = { timestamps: [], lastCleanup: now };
    memoryStore.set(identifier, record);
  }

  // Filter out timestamps outside the active sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
  record.lastCleanup = now;

  const currentCount = record.timestamps.length;
  if (currentCount >= limit) {
    const oldestTimestamp = record.timestamps[0] || windowStart;
    const resetMs = Math.max(0, oldestTimestamp + windowMs - now);
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetMs,
      source: 'memory',
    };
  }

  record.timestamps.push(now);
  const remaining = Math.max(0, limit - record.timestamps.length);
  const resetMs = windowMs;

  return {
    allowed: true,
    limit,
    remaining,
    resetMs,
    source: 'memory',
  };
}

/**
 * Distributed rate limiter with Upstash Redis REST support.
 * 
 * If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are configured,
 * it synchronizes atomically across all serverless instances via HTTP REST.
 * If unconfigured or in test mode, seamlessly falls back to the in-memory sliding window.
 */
export async function checkRateLimitDistributed(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // In test environment or when Upstash is not configured, use local memory sliding window
  if (process.env.NODE_ENV === 'test' || !upstashUrl || !upstashToken) {
    return checkRateLimit(identifier, options);
  }

  const limit = options.limit ?? 20;
  const windowMs = options.windowMs ?? 60_000;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `ratelimit:${identifier}`;

  try {
    // Atomic INCR + EXPIRE via Upstash REST Pipeline
    const response = await fetch(`${upstashUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, windowSec],
        ['TTL', redisKey],
      ]),
      // 1.5s timeout to avoid blocking requests if Redis network latency spikes
      signal: AbortSignal.timeout(1500),
    });

    if (response.ok) {
      const data = await response.json();
      // data format: [ { result: 1 }, { result: 1 }, { result: 60 } ]
      const count = Number(data[0]?.result ?? 1);
      const ttlSec = Number(data[2]?.result ?? windowSec);
      const resetMs = ttlSec > 0 ? ttlSec * 1000 : windowMs;

      if (count > limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetMs,
          source: 'upstash',
        };
      }

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - count),
        resetMs,
        source: 'upstash',
      };
    }
  } catch {
    // Fall back gracefully to memory store on network timeout or Redis error
  }

  return checkRateLimit(identifier, options);
}

/**
 * Generates standard 429 Too Many Requests response with Retry-After header.
 */
export function rateLimitResponse(resetMs: number): NextResponse {
  const retryAfterSec = Math.max(1, Math.ceil(resetMs / 1000));
  return NextResponse.json(
    {
      error: 'Too many requests. Please slow down and try again later.',
      retryAfterSeconds: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
      },
    }
  );
}
