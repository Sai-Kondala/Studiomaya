'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '@/components/CartContext';
import { useRouter } from 'next/navigation';

export default function CartCheckoutPage() {
  const { cart, clearCart } = useCart();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  // Local fallback subtotal (actual validation happens on server)
  const subtotal = cart.reduce((acc, item) => acc + item.price, 0);

  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // If cart is empty and we haven't just succeeded, redirect to home
    if (cart.length === 0 && !isVerifying && !isSuccess) {
      router.push('/');
    }
  }, [cart, router, isVerifying, isSuccess]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Ask server to verify prices and create Razorpay order
      const res = await fetch('/api/cart-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: cart.map(item => item.id),
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      // 2. Open Razorpay checkout
      const options = {
        key: data.keyId, 
        amount: data.amount, // Server verified amount
        currency: 'INR',
        name: 'Studio Maya',
        description: 'Digital Products Purchase',
        order_id: data.orderId,
        handler: async function (response: any) {
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
              }),
            });
            
            const verifyData = await verifyRes.json();
            
            if (verifyRes.ok) {
              setIsSuccess(true);
              clearCart();
              router.push('/thank-you');
            } else {
              setError(verifyData.error || 'Payment verification failed');
              setIsVerifying(false);
              setLoading(false);
            }
          } catch (err: any) {
            setError(err.message || 'Payment verification failed');
            setIsVerifying(false);
            setLoading(false);
          }
        },
        prefill: {
          name: formData.customerName,
          email: formData.customerEmail,
          contact: formData.customerPhone,
        },
        theme: {
          color: '#000000',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setError(response.error.description || 'Payment failed');
      });
      rzp.open();
      
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0 && !isVerifying && !isSuccess) return null; // Let useEffect redirect

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Customer Details Form */}
        <div className="bg-white p-8 shadow-sm rounded-2xl border border-gray-100 text-gray-900">
          {isVerifying ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-gray-100 border-t-black rounded-full animate-spin mx-auto mb-6"></div>
              <h3 className="text-2xl font-bold mb-2">Verifying Payment...</h3>
              <p className="text-gray-500">Please don't close this window. We are preparing your files.</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Customer Details</h2>
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCheckout} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900">Full Name</label>
              <input
                type="text"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
                value={formData.customerName}
                onChange={(e) => setFormData({...formData, customerName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900">Email Address</label>
              <input
                type="email"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
                value={formData.customerEmail}
                onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900">Phone Number</label>
              <input
                type="tel"
                required
                pattern="[0-9]{10,15}"
                title="Please enter a valid phone number"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
                value={formData.customerPhone}
                onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white px-6 py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors mt-4 disabled:bg-gray-400"
            >
              {loading ? 'Processing...' : `Pay ₹${subtotal}`}
            </button>
          </form>
          </>
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-white p-8 shadow-sm rounded-2xl border border-gray-100 h-fit text-gray-900">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Order Summary</h2>
          <div className="space-y-4 mb-6">
            {cart.map((item) => (
              <div key={item.id} className="flex gap-4 items-center">
                <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-lg border" />
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{item.name}</h4>
                  <p className="text-sm text-gray-500">Qty: 1</p>
                </div>
                <div className="font-bold">₹{item.price}</div>
              </div>
            ))}
          </div>
          <div className="border-t pt-4 flex justify-between items-center text-lg font-bold text-gray-900">
            <span>Total</span>
            <span>₹{subtotal}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
