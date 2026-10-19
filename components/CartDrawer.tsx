'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from './CartContext';
import { useRouter } from 'next/navigation';
import { Clock, ShoppingBag } from 'lucide-react';

export function CartDrawer() {
  const { cart, removeFromCart, isCartOpen, setIsCartOpen, user } = useCart();
  const router = useRouter();

  if (!isCartOpen) return null;

  const subtotal = cart.reduce((total, item) => total + item.price, 0);

  const handleCheckout = () => {
    setIsCartOpen(false);
    if (!user) {
      router.push('/login?next=/cart-checkout');
      return;
    }
    router.push('/cart-checkout');
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity backdrop-blur-xs"
        onClick={() => setIsCartOpen(false)}
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#FAF8F5] shadow-2xl z-50 flex flex-col transform transition-transform text-[#171717] border-l border-[#C8B69A]/30">
        <div className="p-6 border-b border-[#C8B69A]/30 flex justify-between items-center bg-[#F7F4EF]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-serif font-medium text-[#171717]">Your Cart</h2>
            <span className="text-[11px] font-mono uppercase tracking-wider bg-[#F2EEFA] text-[#5D4396] border border-[#B8A5E8]/40 px-2 py-0.5 rounded-md font-semibold">
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 hover:bg-[#FAF8F5] rounded-md text-[#171717]/60 hover:text-[#171717] border border-transparent hover:border-[#C8B69A]/40 transition-colors cursor-pointer"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="text-center text-[#171717]/60 mt-16">
              <div className="w-14 h-14 bg-[#F7F4EF] border border-[#C8B69A]/40 rounded-xl flex items-center justify-center mx-auto mb-4 text-[#C8B69A]">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <p className="font-serif text-lg font-medium text-[#171717]">Your cart is empty.</p>
              <p className="text-xs text-[#171717]/60 mt-1 font-sans">Explore our Notion templates to get started.</p>
              <Link 
                href="/#catalog"
                onClick={() => setIsCartOpen(false)}
                className="mt-6 inline-block bg-[#171717] text-[#F7F4EF] px-5 py-2.5 rounded-md text-xs uppercase tracking-wider font-medium hover:bg-[#2E2822] transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-4 border border-[#C8B69A]/30 p-3.5 rounded-xl bg-white shadow-2xs">
                  <img 
                    src={item.image_url} 
                    alt={item.name} 
                    className="w-16 h-16 object-cover rounded-lg border border-[#C8B69A]/20"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-serif font-medium text-[#171717] text-sm line-clamp-2 leading-snug">{item.name}</h3>
                      <p className="text-[11px] font-mono text-[#171717]/50 mt-0.5">Qty: 1 (Digital Access)</p>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-1 border-t border-[#C8B69A]/20">
                      <span className="font-bold text-sm font-sans text-[#171717]">₹{item.price}</span>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-xs font-medium text-red-700 hover:text-red-900 transition-colors cursor-pointer"
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
          <div className="p-6 border-t border-[#C8B69A]/30 bg-[#F7F4EF] text-[#171717]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs uppercase tracking-wider font-mono text-[#171717]/70 font-semibold">Subtotal</span>
              <span className="text-xl font-bold font-sans text-[#171717]">₹{subtotal}</span>
            </div>

            {/* 7-Day Cart Expiration Notice */}
            <div className="mb-4 p-3 bg-[#FAF8F5] border border-[#C8B69A]/40 rounded-xl flex items-start gap-2.5 text-xs text-[#7A6953] leading-relaxed">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-[#C8B69A]" />
              <p className="text-[11px]">
                Your cart is saved for 7 days from your last activity. If you don&apos;t return within 7 days, your cart will expire.
              </p>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-[#171717] text-[#F7F4EF] px-6 py-3.5 rounded-md font-medium text-xs tracking-wider uppercase hover:bg-[#2E2822] transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
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
