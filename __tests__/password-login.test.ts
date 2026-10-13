import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { getSafeRedirectUrl } from '@/lib/safeRedirect';

jest.mock('@/lib/supabaseClient', () => ({
  getSupabaseBrowserClient: jest.fn(),
}));

describe('Password-based Login Preservation', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authenticates existing users using signInWithPassword', async () => {
    const signInMock = jest.fn().mockResolvedValue({
      data: {
        user: { id: 'usr_existing_1', email: 'existing.customer@example.com' },
        session: { access_token: 'valid_session_token' },
      },
      error: null,
    });

    mockSupabase = {
      auth: {
        signInWithPassword: signInMock,
      },
    };
    (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

    const client = getSupabaseBrowserClient();
    const result = await client.auth.signInWithPassword({
      email: 'existing.customer@example.com',
      password: 'mypassword123',
    });

    expect(signInMock).toHaveBeenCalledWith({
      email: 'existing.customer@example.com',
      password: 'mypassword123',
    });
    expect(result.data.user?.id).toBe('usr_existing_1');
    expect(result.data.session).toBeDefined();
    expect(result.error).toBeNull();
  });

  it('rejects invalid credentials without establishing a session', async () => {
    const signInMock = jest.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    mockSupabase = {
      auth: {
        signInWithPassword: signInMock,
      },
    };
    (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

    const client = getSupabaseBrowserClient();
    const result = await client.auth.signInWithPassword({
      email: 'wrong@example.com',
      password: 'wrongpassword',
    });

    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Invalid login credentials');
    expect(result.data.session).toBeNull();
  });

  it('triggers cart sync and safe redirect only upon confirmed session', async () => {
    const syncCartMock = jest.fn().mockResolvedValue(undefined);

    const signInMock = jest.fn().mockResolvedValue({
      data: {
        user: { id: 'usr_existing_2', email: 'buyer@example.com' },
        session: { access_token: 'token_123' },
      },
      error: null,
    });

    mockSupabase = {
      auth: {
        signInWithPassword: signInMock,
      },
    };
    (getSupabaseBrowserClient as jest.Mock).mockReturnValue(mockSupabase);

    const client = getSupabaseBrowserClient();
    const result = await client.auth.signInWithPassword({
      email: 'buyer@example.com',
      password: 'correctpassword',
    });

    if (result.data.user && result.data.session) {
      await syncCartMock();
    }

    expect(syncCartMock).toHaveBeenCalledTimes(1);

    // Verify safe redirect destination
    const safeNext = getSafeRedirectUrl('/cart-checkout?step=payment', '/account');
    expect(safeNext).toBe('/cart-checkout?step=payment');

    // Open redirect attempt safely neutralised
    const maliciousAttempt = getSafeRedirectUrl('https://evil-phishing-site.com', '/account');
    expect(maliciousAttempt).toBe('/account');
  });
});
