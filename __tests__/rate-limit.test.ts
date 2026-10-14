import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  clearRateLimitStore,
} from '@/lib/rateLimit';

describe('Rate Limiter', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  describe('getClientIp', () => {
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
