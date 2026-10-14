import { logger, redactSensitiveData, parseSentryDsn, sendExceptionToSentry } from '@/lib/logger';

describe('Logger & Redaction Utility', () => {
  describe('redactSensitiveData', () => {
    it('redacts sensitive keys including password, token, secret, and authorization', () => {
      const sensitiveInput = {
        email: 'user@example.com',
        password: 'supersecretpassword123',
        authToken: 'jwt-header.payload.signature',
        nested: {
          razorpay_key_secret: 'rzp_sec_xyz',
          publicId: 'pub_123',
        },
      };

      const result = redactSensitiveData(sensitiveInput) as any;

      expect(result.email).toBe('user@example.com');
      expect(result.password).toBe('[REDACTED]');
      expect(result.authToken).toBe('[REDACTED]');
      expect(result.nested.razorpay_key_secret).toBe('[REDACTED]');
      expect(result.nested.publicId).toBe('pub_123');
    });

    it('handles arrays and primitives safely', () => {
      expect(redactSensitiveData(null)).toBeNull();
      expect(redactSensitiveData(undefined)).toBeUndefined();
      expect(redactSensitiveData('regular text')).toBe('regular text');
      expect(redactSensitiveData(12345)).toBe(12345);

      const arrayInput = [{ secret: 'top_secret' }, { normal: 'visible' }];
      const result = redactSensitiveData(arrayInput) as any[];

      expect(result[0].secret).toBe('[REDACTED]');
      expect(result[1].normal).toBe('visible');
    });
  });

  describe('parseSentryDsn', () => {
    it('correctly parses valid Sentry DSN into host, projectId, and publicKey', () => {
      const dsn = 'https://abc123publicKey@o456789.ingest.sentry.io/1234567';
      const parsed = parseSentryDsn(dsn);
      expect(parsed).toEqual({
        host: 'o456789.ingest.sentry.io',
        projectId: '1234567',
        publicKey: 'abc123publicKey',
      });
    });

    it('returns null for invalid DSN formats', () => {
      expect(parseSentryDsn('not-a-url')).toBeNull();
      expect(parseSentryDsn('https://missing-public-key.sentry.io/123')).toBeNull();
    });
  });

  describe('sendExceptionToSentry', () => {
    it('posts formatted event payload to Sentry store API endpoint', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as any);

      const dsn = 'https://mykey@o1234.ingest.sentry.io/999';
      const result = await sendExceptionToSentry(new Error('Test capture error'), { orderId: 'ord_123' }, dsn);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://o1234.ingest.sentry.io/api/999/store/',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Sentry-Auth': expect.stringContaining('sentry_key=mykey'),
          }),
        })
      );

      mockFetch.mockRestore();
    });

    it('returns error result when DSN is not configured', async () => {
      const result = await sendExceptionToSentry(new Error('No DSN test'), {}, '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('SENTRY_DSN is not configured');
    });
  });

  describe('Logger methods', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('logs info messages without throwing', () => {
      expect(() => {
        logger.info('System startup test', { service: 'checkout' });
      }).not.toThrow();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('logs warning messages with context', () => {
      expect(() => {
        logger.warn('Rate limit threshold approached', { ip: '127.0.0.1' });
      }).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('logs errors and handles Error instances', () => {
      const testErr = new Error('Database query timed out');
      expect(() => {
        logger.error('Failed to query database', testErr, { queryId: 'q_123' });
      }).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('captures exceptions without crashing', () => {
      expect(() => {
        logger.captureException(new Error('Unhandled runtime crash mock'));
      }).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
