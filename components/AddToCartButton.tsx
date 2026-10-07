'use client';

import React from 'react';
import { useCart, CartItem } from './CartContext';

interface AddToCartButtonProps {
  product: CartItem;
  className?: string;
  variant?: 'outline' | 'solid';
}

export function AddToCartButton({ product, className = '', variant = 'outline' }: AddToCartButtonProps) {
  const { addToCart, cart } = useCart();
  
  const inCart = cart.some(item => item.id === product.id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating if wrapped in a Link
    addToCart(product);
  };

  const baseClasses = variant === 'outline' 
    ? 'border-2 border-black text-black hover:bg-black hover:text-white transition-colors' 
    : 'bg-black text-white hover:bg-gray-800 transition-colors';

  return (
    <button
      onClick={handleClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${baseClasses} ${className}`}
    >
      {inCart ? 'In Cart' : 'Add to Cart'}
    </button>
  );
}
