import { NextResponse } from 'next/server';

interface RateLimitOptions {
  limit?: number; // max requests allowed per window
  windowMs?: number; // window duration in milliseconds
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

interface WindowRecord {
  timestamps: number[];
  lastCleanup: number;
}

// In-memory sliding window record store
const memoryStore = new Map<string, WindowRecord>();

/**
 * Resets the in-memory rate limit store (primarily for unit testing).
 */
export function clearRateLimitStore(): void {
  memoryStore.clear();
}

/**
 * Extracts client IP safely from request headers.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }

  return '127.0.0.1';
}

/**
 * Evaluates rate limit using a sliding-window algorithm.
 * 
 * Default limits: 20 requests per 60 seconds per identifier.
 * Highly permissive for legitimate users, but throttles automated brute-force attacks.
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 20;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = memoryStore.get(identifier);
  if (!record) {
    record = { timestamps: [], lastCleanup: now };
    memoryStore.set(identifier, record);
  }

  // Filter out timestamps outside the active sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
  record.lastCleanup = now;

  // Periodic memory store cleanup if store grows large
  if (memoryStore.size > 2000) {
    for (const [key, item] of memoryStore.entries()) {
      if (item.timestamps.length === 0 || now - item.lastCleanup > windowMs * 2) {
        memoryStore.delete(key);
      }
    }
  }

  const currentCount = record.timestamps.length;
  if (currentCount >= limit) {
    const oldestTimestamp = record.timestamps[0] || windowStart;
    const resetMs = Math.max(0, oldestTimestamp + windowMs - now);
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetMs,
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
  };
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
