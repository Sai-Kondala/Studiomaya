import {
  checkRateLimit,
  checkRateLimitDistributed,
  getClientIp,
  rateLimitResponse,
  clearRateLimitStore,
} from '@/lib/rateLimit';

describe('Rate Limiter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    clearRateLimitStore();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getClientIp', () => {
    it('prioritizes cf-connecting-ip from Cloudflare proxy', () => {
      const req = new Request('http://localhost:3000/api/create-order', {
        headers: {
          'cf-connecting-ip': '198.51.100.99',
          'x-forwarded-for': '203.0.113.195',
        },
      });
      expect(getClientIp(req)).toBe('198.51.100.99');
    });

    it('prioritizes x-vercel-ip from Vercel edge', () => {
      const req = new Request('http://localhost:3000/api/create-order', {
        headers: {
          'x-vercel-ip': '198.51.100.88',
          'x-forwarded-for': '203.0.113.195',
        },
      });
      expect(getClientIp(req)).toBe('198.51.100.88');
    });

    it('extracts the first IP from x-forwarded-for header', () => {
      const req = new Request('http://localhost:3000/api/create-order', {
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
        },
      });
      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', () => {
      const req = new Request('http://localhost:3000/api/create-order', {
        headers: {
          'x-real-ip': '198.51.100.22',
        },
      });
      expect(getClientIp(req)).toBe('198.51.100.22');
    });

    it('falls back to 127.0.0.1 when no IP headers are present', () => {
      const req = new Request('http://localhost:3000/api/create-order');
      expect(getClientIp(req)).toBe('127.0.0.1');
    });
  });

  describe('checkRateLimit sliding window', () => {
    it('allows requests within the specified limit', () => {
      const id = 'client_test_1';
      const opt = { limit: 3, windowMs: 10000 };

      const r1 = checkRateLimit(id, opt);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = checkRateLimit(id, opt);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = checkRateLimit(id, opt);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);
    });

    it('blocks subsequent requests exceeding limit with 0 remaining', () => {
      const id = 'client_test_blocked';
      const opt = { limit: 2, windowMs: 10000 };

      checkRateLimit(id, opt);
      checkRateLimit(id, opt);

      const r3 = checkRateLimit(id, opt);
      expect(r3.allowed).toBe(false);
      expect(r3.remaining).toBe(0);
      expect(r3.resetMs).toBeGreaterThan(0);
    });

    it('isolates different client identifiers', () => {
      const opt = { limit: 1, windowMs: 10000 };

      const rA1 = checkRateLimit('client_A', opt);
      const rB1 = checkRateLimit('client_B', opt);

      expect(rA1.allowed).toBe(true);
      expect(rB1.allowed).toBe(true);

      const rA2 = checkRateLimit('client_A', opt);
      expect(rA2.allowed).toBe(false);

      // client_B was not called twice
      const rC = checkRateLimit('client_C', opt);
      expect(rC.allowed).toBe(true);
    });
  });

  describe('checkRateLimitDistributed', () => {
    it('falls back to local memory store when Upstash is not configured', async () => {
      const res = await checkRateLimitDistributed('dist_test_client', { limit: 5 });
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(4);
    });

    it('interfaces with Upstash REST pipeline when configured', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
      process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash-redis.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake_token';

      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => [{ result: 1 }, { result: 1 }, { result: 60 }],
      } as any);

      const res = await checkRateLimitDistributed('dist_redis_client', { limit: 5 });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://fake-upstash-redis.upstash.io/pipeline',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer fake_token',
          }),
        })
      );
      expect(res.allowed).toBe(true);
      expect(res.source).toBe('upstash');

      mockFetch.mockRestore();
    });

    it('falls back gracefully to memory store if Upstash fetch fails', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
      process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash-redis.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake_token';

      const mockFetch = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection timeout'));

      const res = await checkRateLimitDistributed('dist_fail_client', { limit: 5 });
      expect(res.allowed).toBe(true);
      expect(res.source).toBe('memory_degraded');

      mockFetch.mockRestore();
    });

    it('blocks request with failClosed when Upstash fetch fails', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
      process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash-redis.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake_token';

      const mockFetch = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Redis connection refused'));

      const res = await checkRateLimitDistributed('dist_fail_client_closed', { limit: 5, failClosed: true });
      expect(res.allowed).toBe(false);
      expect(res.source).toBe('upstash_error_fail_closed');

      mockFetch.mockRestore();
    });
  });

  describe('rateLimitResponse', () => {
    it('returns a 429 response with appropriate Retry-After header', async () => {
      const res = rateLimitResponse(15000);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('15');

      const body = await res.json();
      expect(body.error).toContain('Too many requests');
      expect(body.retryAfterSeconds).toBe(15);
    });
  });
});
