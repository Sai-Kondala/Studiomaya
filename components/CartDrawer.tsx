'use client';

import React, { useState } from 'react';
import { useCart } from './CartContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col transform transition-transform text-gray-900">
        <div className="p-6 border-b flex justify-between items-center text-gray-900">
          <h2 className="text-xl font-bold">Your Cart</h2>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <p>Your cart is empty.</p>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="mt-4 text-black font-medium hover:underline"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4 border-b pb-4">
                  <img 
                    src={item.image_url} 
                    alt={item.name} 
                    className="w-20 h-20 object-cover rounded-lg border"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 line-clamp-2">{item.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">Qty: 1 (Digital Product)</p>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-bold">₹{item.price}</span>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-sm text-red-500 hover:text-red-700"
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
          <div className="p-6 border-t bg-gray-50 text-gray-900">
            <div className="flex justify-between items-center mb-4 text-lg font-bold">
              <span>Total</span>
              <span>₹{subtotal}</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full bg-black text-white px-6 py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
