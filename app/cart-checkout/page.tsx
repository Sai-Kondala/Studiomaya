'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '@/components/CartContext';
import { useRouter } from 'next/navigation';
import { Clock, ShieldCheck } from 'lucide-react';

export default function CartCheckoutPage() {
  const { cart, clearCart, user, isUserLoading } = useCart();
  const router = useRouter();

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  });

  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Derive initial values from authenticated user if not overridden by user
  const effectiveName = formData.customerName || user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const effectiveEmail = formData.customerEmail || user?.email || '';

  // Local fallback subtotal (actual validation happens canonically on server)
  const subtotal = cart.reduce((acc, item) => acc + item.price, 0);

  useEffect(() => {
    // If not loading and user is not logged in, redirect to login first
    if (!isUserLoading && !user && !isSuccess && !isVerifying) {
      router.push('/login?next=/cart-checkout');
      return;
    }
    // If cart is empty and not verifying/succeeded, redirect to home
    if (cart.length === 0 && !isVerifying && !isSuccess) {
      router.push('/');
    }
  }, [user, isUserLoading, cart, router, isVerifying, isSuccess]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Verify canonical DB prices and create Razorpay order on server
      const res = await fetch('/api/cart-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: cart.map((item) => item.id),
          customerName: effectiveName,
          customerEmail: effectiveEmail,
          customerPhone: formData.customerPhone,
          userId: user?.id || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      // 2. Open Razorpay checkout modal
      const options = {
        key: data.keyId,
        amount: data.amount, // Server verified amount
        currency: 'INR',
        name: 'Studio Maya',
        description: 'Digital Products Purchase',
        order_id: data.orderId,
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          setIsVerifying(true);
          setError('');
          try {
            const verifyRes = await fetch('/api/verify-cart-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                userId: user?.id || null,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok) {
              setIsSuccess(true);
              clearCart();
              router.push('/thank-you?orderId=' + encodeURIComponent(response.razorpay_order_id));
            } else {
              setError(verifyData.error || 'Payment verification failed');
              setIsVerifying(false);
              setLoading(false);
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Payment verification failed';
            setError(message);
            setIsVerifying(false);
            setLoading(false);
          }
        },
        prefill: {
          name: effectiveName,
          email: effectiveEmail,
          contact: formData.customerPhone,
        },
        theme: {
          color: '#000000',
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay(options);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rzp.on('payment.failed', function (response: any) {
        setError(response.error?.description || 'Payment failed');
        setLoading(false);
      });
      rzp.open();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      setLoading(false);
    }
  };

  if (cart.length === 0 && !isVerifying && !isSuccess) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Customer Details Form */}
        <div className="bg-white p-8 sm:p-10 shadow-sm rounded-3xl border border-gray-100">
          {isVerifying ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-gray-100 border-t-black rounded-full animate-spin mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2 text-gray-950">Verifying Payment...</h3>
              <p className="text-gray-500 text-sm">Please don&apos;t close this window. We are preparing your download access.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-extrabold text-gray-950">Customer Details</h2>
                {user && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">
                    Logged In
                  </span>
                )}
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-100 leading-relaxed">
                  {error}
                </div>
              )}

              <form onSubmit={handleCheckout} className="space-y-4">
                <div>
                  <label htmlFor="customerName" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="customerName"
                    type="text"
                    required
                    autoComplete="name"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all bg-gray-50/50"
                    value={formData.customerName || effectiveName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="e.g. Sai Ganesh"
                  />
                </div>

                <div>
                  <label htmlFor="customerEmail" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                    Email Address (For Delivery)
                  </label>
                  <input
                    id="customerEmail"
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all bg-gray-50/50"
                    value={formData.customerEmail || effectiveEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="customerPhone" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    id="customerPhone"
                    type="tel"
                    required
                    pattern="[0-9]{10,15}"
                    autoComplete="tel"
                    title="Please enter a valid 10-15 digit phone number"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all bg-gray-50/50"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    placeholder="e.g. 9876543210"
                  />
                </div>

                {/* 7-Day Cart Expiration Notice (Displayed immediately above checkout button on desktop & mobile) */}
                <div className="pt-2">
                  <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
                    <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <p>
                      Your cart is saved for 7 days from your last cart activity. If you don&apos;t return within 7 days, your saved cart will expire and its items will need to be added again.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white px-6 py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors mt-2 disabled:bg-gray-400 text-sm shadow-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing Order...</span>
                    </>
                  ) : (
                    <span>Pay ₹{subtotal} →</span>
                  )}
                </button>

                <div className="pt-2 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-gray-400" />
                  <span>256-bit encrypted checkout via Razorpay</span>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-white p-8 sm:p-10 shadow-sm rounded-3xl border border-gray-100">
          <h2 className="text-xl font-extrabold mb-6 text-gray-950 flex items-center gap-2">
            <span>Order Summary</span>
            <span className="text-xs bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
          </h2>

          <div className="space-y-4 mb-6 divide-y divide-gray-100">
            {cart.map((item) => (
              <div key={item.id} className="flex gap-4 items-center pt-4 first:pt-0">
                <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-xl border border-gray-100" />
                <div className="flex-1">
                  <h4 className="font-bold text-gray-950 text-sm">{item.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Instant Digital Download</p>
                </div>
                <div className="font-bold text-sm text-gray-950">₹{item.price}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-lg font-bold text-gray-950">
            <span className="text-sm font-medium text-gray-500">Total Payable</span>
            <span className="text-2xl font-extrabold">₹{subtotal}</span>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-500 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-black">✓</span>
              <span>Instant email delivery upon payment completion</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-black">✓</span>
              <span>Available in your customer account dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-black">✓</span>
              <span>Lifetime workspace access & updates</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
