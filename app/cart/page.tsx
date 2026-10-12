'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/CartContext';
import { Navbar } from '@/components/Navbar';
import { Clock, ShoppingBag, ArrowRight } from 'lucide-react';

export default function CartPage() {
  const { cart, removeFromCart } = useCart();
  const router = useRouter();

  const subtotal = cart.reduce((total, item) => total + item.price, 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-12 w-full flex-1">
        <h1 className="text-3xl font-extrabold text-gray-950 tracking-tight mb-8">
          Shopping Cart
        </h1>

        {cart.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-xs">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-950">Your cart is empty</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              You haven&apos;t added any products to your cart yet.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block bg-black text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Items list */}
            <div className="md:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs divide-y divide-gray-100">
              {cart.map((item) => (
                <div key={item.id} className="py-5 first:pt-0 last:pb-0 flex gap-4 items-center">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded-2xl border border-gray-100"
                  />
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-950 text-base">{item.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Instant Digital Download</p>
                    <div className="mt-2 text-sm font-bold text-gray-950">₹{item.price}</div>
                  </div>
                  <div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart summary & 7-day expiration notice */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
              <h2 className="text-xl font-bold text-gray-950">Summary</h2>

              <div className="flex justify-between items-center text-lg font-bold text-gray-950 border-b border-gray-100 pb-4">
                <span className="text-sm font-medium text-gray-500">Subtotal</span>
                <span>₹{subtotal}</span>
              </div>

              {/* 7-Day Cart Expiration Notice immediately above checkout button */}
              <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <p>
                  Your cart is saved for 7 days from your last cart activity. If you don&apos;t return within 7 days, your saved cart will expire and its items will need to be added again.
                </p>
              </div>

              <button
                onClick={() => router.push('/cart-checkout')}
                className="w-full bg-black text-white px-6 py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
