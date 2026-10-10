'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { updateSettingsAction } from './actions';

export default function AdminSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase
        .from('admin_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data) {
        setSettings(data);
      }
      setLoading(false);
    }
    fetchSettings();
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading settings...</div>;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      await updateSettingsAction(formData);
      alert('Settings saved successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Store Settings */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold border-b pb-4 mb-4">A. Store Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">Store Name</label>
              <input type="text" name="store_name" className="w-full border rounded-lg p-2" defaultValue={settings?.store_name || 'Studio Maya'} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Store Email</label>
              <input type="email" name="store_email" className="w-full border rounded-lg p-2" defaultValue={settings?.store_email || ''} placeholder="contact@studiomaya.store" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Store Description</label>
              <textarea name="store_description" className="w-full border rounded-lg p-2" rows={2} defaultValue={settings?.store_description || 'Premium digital workspaces'}></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Store Phone</label>
              <input type="tel" name="store_phone" className="w-full border rounded-lg p-2" defaultValue={settings?.store_phone || ''} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select name="currency" className="w-full border rounded-lg p-2 bg-white" defaultValue={settings?.currency || 'INR'}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Payment Settings */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold border-b pb-4 mb-4">B. Payment Settings</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border">
              <div>
                <p className="font-medium text-gray-900">Razorpay Configuration</p>
                <p className="text-sm text-gray-500">Keys are configured via environment variables (.env.local)</p>
              </div>
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">Configured</span>
            </div>
            
            <div className="flex items-center gap-2">
              <input type="checkbox" id="testMode" defaultChecked className="w-4 h-4 text-black" />
              <label htmlFor="testMode" className="text-sm font-medium">Enable Test Mode</label>
            </div>
          </div>
        </section>

        {/* Email Settings */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold border-b pb-4 mb-4">C. Email Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Sender Name</label>
              <input type="text" className="w-full border rounded-lg p-2" defaultValue="Studio Maya" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sender Email</label>
              <input type="email" className="w-full border rounded-lg p-2" defaultValue="contact@studiomaya.store" />
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-black" />
              <span className="text-sm font-medium">Order confirmation email enabled</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-black" />
              <span className="text-sm font-medium">Product delivery email enabled</span>
            </label>
          </div>
        </section>

        {/* Order Settings */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold border-b pb-4 mb-4">D. Order Settings</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-black" />
              <span className="text-sm font-medium">Automatically send product after successful payment</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" disabled className="w-4 h-4 text-gray-300" />
              <span className="text-sm font-medium text-gray-500">Allow customer order cancellation (Not applicable for digital products)</span>
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="bg-black text-white px-6 py-2.5 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-400">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

      </form>
    </div>
  );
}
