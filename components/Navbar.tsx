'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from './CartContext';

export function Navbar() {
  const { cart, setIsCartOpen } = useCart();

  return (
    <nav className="flex justify-between items-center py-6 px-8 max-w-6xl mx-auto">
      <Link href="/" className="font-bold text-xl flex items-center gap-2">
        <div className="w-6 h-6 bg-black rounded-md"></div>
        Studio Maya
      </Link>
      <div className="space-x-6 text-sm font-medium text-gray-600 hidden md:block">
        <Link href="/" className="text-black">Products</Link>
        <Link href="#" className="hover:text-black">Categories</Link>
        <Link href="#" className="hover:text-black">About</Link>
      </div>
      <div>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="p-2 hover:bg-gray-200 rounded-full relative"
        >
          🛒
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
              {cart.length}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
