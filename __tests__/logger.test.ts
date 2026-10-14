import { logger, redactSensitiveData } from '@/lib/logger';

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
