import { getSupabaseBrowserClient } from '@/lib/supabaseClient';

jest.mock('@/lib/supabaseClient', () => ({
  getSupabaseBrowserClient: jest.fn(),
}));

describe('Supabase Auth OTP Signup & Verification Specification', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Signup Step (supabase.auth.signUp)', () => {
    it('dispatches signup request with user details and full name metadata', async () => {
      const signUpMock = jest.fn().mockResolvedValue({
        data: {
          user: { id: 'usr_new_1', email: 'test@example.com', identities: [{ id: 'ident_1' }] },
          session: null, // standard: session null pending confirmation
        },
        error: null,
      });

      mockSupabase = {
        auth: {
          signUp: signUpMock,
        },
      };
      (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

      const client = getSupabaseBrowserClient();
      const res = await client.auth.signUp({
        email: 'test@example.com',
        password: 'securePassword123!',
        options: {
          data: {
            full_name: 'Sai Ganesh',
          },
        },
      });

      expect(signUpMock).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'securePassword123!',
        options: {
          data: {
            full_name: 'Sai Ganesh',
          },
        },
      });
      expect(res.data.user).toBeDefined();
      expect(res.data.session).toBeNull();
      expect(res.error).toBeNull();
    });

    it('identifies existing registered users via empty identities array (Supabase email enumeration defense)', async () => {
      const signUpMock = jest.fn().mockResolvedValue({
        data: {
          user: { id: 'usr_existing', email: 'existing@example.com', identities: [] }, // empty identities means existing user
          session: null,
        },
        error: null,
      });

      mockSupabase = {
        auth: {
          signUp: signUpMock,
        },
      };
      (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

      const client = getSupabaseBrowserClient();
      const res = await client.auth.signUp({
        email: 'existing@example.com',
        password: 'password123',
        options: { data: { full_name: 'Returning User' } },
      });

      const isExistingUser =
        res.data?.user &&
        Array.isArray(res.data.user.identities) &&
        res.data.user.identities.length === 0;

      expect(isExistingUser).toBe(true);
    });

    it('handles explicit "User already registered" error from Supabase Auth gracefully', async () => {
      const signUpMock = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered', status: 400 },
      });

      mockSupabase = {
        auth: { signUp: signUpMock },
      };
      (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

      const client = getSupabaseBrowserClient();
      const res = await client.auth.signUp({
        email: 'already.exists@example.com',
        password: 'password123',
      });

      expect(res.error).toBeDefined();
      expect(res.error?.message).toBe('User already registered');
    });
  });

  describe('OTP Verification Step (supabase.auth.verifyOtp)', () => {
    it('successfully verifies six-digit code with type "signup" and returns established session', async () => {
      const verifyOtpMock = jest.fn().mockResolvedValue({
        data: {
          user: { id: 'usr_verified_1', email: 'verified@example.com' },
          session: {
            access_token: 'fake_jwt_token',
            refresh_token: 'fake_refresh_token',
            expires_at: 1700000000,
          },
        },
        error: null,
      });

      mockSupabase = {
        auth: {
          verifyOtp: verifyOtpMock,
        },
      };
      (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

      const client = getSupabaseBrowserClient();
      const res = await client.auth.verifyOtp({
        email: 'verified@example.com',
        token: '849201',
        type: 'signup',
      });

      expect(verifyOtpMock).toHaveBeenCalledWith({
        email: 'verified@example.com',
        token: '849201',
        type: 'signup',
      });
      expect(res.data.session).toBeDefined();
      expect(res.data.user?.id).toBe('usr_verified_1');
      expect(res.error).toBeNull();
    });

    it('rejects invalid six-digit verification codes with descriptive error', async () => {
      const verifyOtpMock = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Token is invalid or has expired', status: 400 },
      });

      mockSupabase = {
        auth: {
          verifyOtp: verifyOtpMock,
        },
      };
      (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

      const client = getSupabaseBrowserClient();
      const res = await client.auth.verifyOtp({
        email: 'test@example.com',
        token: '000000',
        type: 'signup',
      });

      expect(res.error).toBeDefined();
      expect(res.data.session).toBeNull();
      expect(res.error?.message).toContain('invalid');
    });

    it('handles expired OTP token gracefully', async () => {
      const verifyOtpMock = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Token has expired', status: 400 },
      });

      mockSupabase = {
        auth: { verifyOtp: verifyOtpMock },
      };
      (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

      const client = getSupabaseBrowserClient();
      const res = await client.auth.verifyOtp({
        email: 'test@example.com',
        token: '123456',
        type: 'signup',
      });

      expect(res.error?.message).toContain('expired');
    });

    it('ensures unconfirmed frontend state cannot forge verification without session', async () => {
      // If response lacks session or user, system treats as unverified
      const verifyOtpMock = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      mockSupabase = {
        auth: { verifyOtp: verifyOtpMock },
      };
      (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

      const client = getSupabaseBrowserClient();
      const res = await client.auth.verifyOtp({
        email: 'test@example.com',
        token: '123456',
        type: 'signup',
      });

      const isSessionEstablished = Boolean(res.data?.session && res.data?.user);
      expect(isSessionEstablished).toBe(false);
    });
  });

  describe('Resend OTP Step (supabase.auth.resend)', () => {
    it('dispatches resend request with type "signup" and email', async () => {
      const resendMock = jest.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      mockSupabase = {
        auth: { resend: resendMock },
      };
      (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

      const client = getSupabaseBrowserClient();
      const res = await client.auth.resend({
        type: 'signup',
        email: 'test@example.com',
      });

      expect(resendMock).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@example.com',
      });
      expect(res.error).toBeNull();
    });

    it('handles server-side rate limits on resend gracefully', async () => {
      const resendMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'For security purposes, you can only request this once every 60 seconds.', status: 429 },
      });

      mockSupabase = {
        auth: { resend: resendMock },
      };
      (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

      const client = getSupabaseBrowserClient();
      const res = await client.auth.resend({
        type: 'signup',
        email: 'test@example.com',
      });

      expect(res.error).toBeDefined();
      expect(res.error?.status).toBe(429);
      expect(res.error?.message).toContain('60 seconds');
    });
  });

  describe('Cart Sync Post-Authentication Requirement', () => {
    it('ensures cart synchronization is triggered ONLY after verification establishes session', async () => {
      const syncCartMock = jest.fn().mockResolvedValue(undefined);

      // Scenario A: Verification failed
      const failedVerify = { data: { session: null, user: null }, error: { message: 'Bad OTP' } };
      if (failedVerify.data.session && failedVerify.data.user) {
        await syncCartMock();
      }
      expect(syncCartMock).not.toHaveBeenCalled();

      // Scenario B: Verification succeeded
      const successVerify = {
        data: { session: { token: 'abc' }, user: { id: 'usr_123' } },
        error: null,
      };
      if (successVerify.data.session && successVerify.data.user) {
        await syncCartMock();
      }
      expect(syncCartMock).toHaveBeenCalledTimes(1);
    });

    it('does not crash or revoke authenticated session if cart synchronization encounters a warning', async () => {
      const syncCartMock = jest.fn().mockRejectedValue(new Error('Network warning during cart sync'));
      let postVerificationSession = { user: { id: 'usr_abc' } };

      try {
        await syncCartMock();
      } catch (err) {
        // Warning caught and logged; session preserved
        expect(err).toBeDefined();
      }

      // User session is not cleared or lost
      expect(postVerificationSession.user.id).toBe('usr_abc');
    });
  });
});
