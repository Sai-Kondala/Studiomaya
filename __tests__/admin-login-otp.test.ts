import { POST } from '@/app/api/admin/login/route';
import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';

jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

describe('Admin Login Two-Factor OTP Specification', () => {
  let mockSupabaseAdmin: any;
  let mockSsrClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthorized users not present in the admin_users whitelist with 403', async () => {
    mockSupabaseAdmin = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabaseAdmin);

    const req = new NextRequest('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'unauthorized@example.com',
        password: 'password123',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain('not on the authorized admin whitelist');
  });

  it('rejects invalid credentials with 401 when password fails', async () => {
    mockSupabaseAdmin = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { email: 'admin@studiomaya.store' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabaseAdmin);

    mockSsrClient = {
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid login credentials' },
        }),
      },
    };
    (createServerClient as jest.Mock).mockReturnValue(mockSsrClient);

    const req = new NextRequest('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@studiomaya.store',
        password: 'wrongpassword',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toContain('Invalid');
  });

  it('verifies credentials and dispatches 6-digit OTP without issuing session cookie immediately', async () => {
    mockSupabaseAdmin = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { email: 'admin@studiomaya.store' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabaseAdmin);

    const signInWithOtpMock = jest.fn().mockResolvedValue({ error: null });
    mockSsrClient = {
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: 'admin_usr_1', email: 'admin@studiomaya.store' } },
          error: null,
        }),
        signInWithOtp: signInWithOtpMock,
      },
    };
    (createServerClient as jest.Mock).mockReturnValue(mockSsrClient);

    const req = new NextRequest('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@studiomaya.store',
        password: 'compromisedOrCorrectPassword',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.step).toBe('otp');
    // Confirms signInWithOtp was dispatched to admin email
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: 'admin@studiomaya.store',
      options: { shouldCreateUser: false },
    });
  });

  it('supports resending OTP code for whitelisted admin', async () => {
    mockSupabaseAdmin = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { email: 'admin@studiomaya.store' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabaseAdmin);

    const signInWithOtpMock = jest.fn().mockResolvedValue({ error: null });
    mockSsrClient = {
      auth: {
        signInWithOtp: signInWithOtpMock,
      },
    };
    (createServerClient as jest.Mock).mockReturnValue(mockSsrClient);

    const req = new NextRequest('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resend-otp',
        email: 'admin@studiomaya.store',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: 'admin@studiomaya.store',
      options: { shouldCreateUser: false },
    });
  });
});
