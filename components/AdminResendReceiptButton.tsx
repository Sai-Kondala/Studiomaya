'use client';

import React, { useState } from 'react';
import { resendOrderReceiptAction } from '@/app/admin/orders/actions';

export function AdminResendReceiptButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleResend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    setStatus(null);
    try {
      const res = await resendOrderReceiptAction(orderId);
      if (res.success) {
        setStatus('Sent!');
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to resend receipt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleResend}
      disabled={loading}
      className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 transition cursor-pointer"
      title="Resend receipt email to customer"
    >
      {loading ? 'Sending...' : status || 'Resend Email'}
    </button>
  );
}
