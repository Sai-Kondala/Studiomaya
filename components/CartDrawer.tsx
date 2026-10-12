'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from './CartContext';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';

export function CartDrawer() {
  const { cart, removeFromCart, isCartOpen, setIsCartOpen } = useCart();
  const router = useRouter();

  if (!isCartOpen) return null;

  const subtotal = cart.reduce((total, item) => total + item.price, 0);

  const handleCheckout = () => {
    setIsCartOpen(false);
    router.push('/cart-checkout');
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity backdrop-blur-xs"
        onClick={() => setIsCartOpen(false)}
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transform transition-transform text-gray-900">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center text-gray-900">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Your Cart</h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-black transition-colors"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center text-gray-500 mt-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                🛒
              </div>
              <p className="font-medium text-gray-900">Your cart is empty.</p>
              <p className="text-sm text-gray-500 mt-1">Explore our Notion templates to get started.</p>
              <Link 
                href="/"
                onClick={() => setIsCartOpen(false)}
                className="mt-6 inline-block bg-black text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4 border border-gray-100 p-3.5 rounded-2xl bg-white shadow-xs">
                  <img 
                    src={item.image_url} 
                    alt={item.name} 
                    className="w-18 h-18 object-cover rounded-xl border border-gray-100"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{item.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Qty: 1 (Digital Access)</p>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-50">
                      <span className="font-bold text-sm text-gray-950">₹{item.price}</span>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-6 border-t border-gray-100 bg-gray-50/80 text-gray-900">
            <div className="flex justify-between items-center mb-3 text-lg font-bold">
              <span className="text-sm text-gray-600 font-medium">Subtotal</span>
              <span className="text-xl">₹{subtotal}</span>
            </div>

            {/* 7-Day Cart Expiration Notice */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <p>
                Your cart is saved for 7 days from your last cart activity. If you don&apos;t return within 7 days, your saved cart will expire and its items will need to be added again.
              </p>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-black text-white px-6 py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 shadow-sm text-sm"
            >
              <span>Proceed to Checkout</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
