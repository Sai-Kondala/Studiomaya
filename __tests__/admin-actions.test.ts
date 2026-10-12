import { createProductAction, updateProductAction } from '@/app/admin/products/actions';
import { updateSettingsAction } from '@/app/admin/settings/actions';
import { verifyAdminSession } from '@/lib/adminAuth';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

jest.mock('@/lib/adminAuth', () => ({
  verifyAdminSession: jest.fn(),
}));

jest.mock('@/lib/supabaseAdmin', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('Admin Server Actions Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unauthenticated callers', () => {
    beforeEach(() => {
      (verifyAdminSession as jest.Mock).mockRejectedValue(
        new Error('Unauthorized: Authentication required.')
      );
    });

    it('createProductAction should reject unauthenticated visitors', async () => {
      const formData = new FormData();
      formData.set('title', 'Test Product');
      await expect(createProductAction(formData)).rejects.toThrow('Unauthorized');
    });

    it('updateProductAction should reject unauthenticated visitors', async () => {
      const formData = new FormData();
      formData.set('title', 'Updated Product');
      await expect(updateProductAction('prod_1', formData)).rejects.toThrow('Unauthorized');
    });

    it('updateSettingsAction should reject unauthenticated visitors', async () => {
      const formData = new FormData();
      formData.set('store_name', 'Hacked Store');
      await expect(updateSettingsAction(formData)).rejects.toThrow('Unauthorized');
    });
  });

  describe('Signed-in non-admin callers (not in admin_users whitelist)', () => {
    beforeEach(() => {
      (verifyAdminSession as jest.Mock).mockRejectedValue(
        new Error('Unauthorized: Admin privileges required.')
      );
    });

    it('createProductAction should reject non-admin users', async () => {
      const formData = new FormData();
      formData.set('title', 'Malicious Product');
      await expect(createProductAction(formData)).rejects.toThrow('Unauthorized');
    });

    it('updateProductAction should reject non-admin users', async () => {
      const formData = new FormData();
      formData.set('title', 'Malicious Update');
      await expect(updateProductAction('prod_1', formData)).rejects.toThrow('Unauthorized');
    });

    it('updateSettingsAction should reject non-admin users', async () => {
      const formData = new FormData();
      formData.set('store_name', 'Unauthorized Change');
      await expect(updateSettingsAction(formData)).rejects.toThrow('Unauthorized');
    });
  });

  describe('Authorized administrators', () => {
    it('updateSettingsAction should succeed when caller is a verified admin', async () => {
      const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
      const mockAdminClient = {
        from: jest.fn().mockReturnValue({
          select: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: 'settings_1' } }),
            }),
          }),
          update: mockUpdate,
        }),
      };

      (verifyAdminSession as jest.Mock).mockResolvedValue({
        user: { id: 'admin_1', email: 'admin@studiomaya.com' },
        supabaseAdmin: mockAdminClient,
      });

      const formData = new FormData();
      formData.set('store_name', 'Studio Maya Official');
      formData.set('store_email', 'admin@studiomaya.com');
      formData.set('store_description', 'Official Store');
      formData.set('store_phone', '1234567890');
      formData.set('currency', 'INR');

      await expect(updateSettingsAction(formData)).resolves.toBeUndefined();
      expect(mockAdminClient.from).toHaveBeenCalledWith('admin_settings');
    });
  });
});
