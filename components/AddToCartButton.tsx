'use client';

import React from 'react';
import { useCart, CartItem } from './CartContext';
import { ShoppingBag, Check } from 'lucide-react';

interface AddToCartButtonProps {
  product: CartItem;
  className?: string;
  variant?: 'outline' | 'solid';
  showIcon?: boolean;
}

export function AddToCartButton({
  product,
  className = '',
  variant = 'outline',
  showIcon = false,
}: AddToCartButtonProps) {
  const { addToCart, cart, isHydrated } = useCart();
  
  const inCart = isHydrated && cart.some(item => item.id === product.id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
  };

  const baseClasses = variant === 'outline' 
    ? 'border border-[#C8B69A]/70 text-[#171717] hover:border-[#171717] hover:bg-[#171717] hover:text-[#F7F4EF] transition-all' 
    : 'bg-[#171717] text-[#F7F4EF] hover:bg-[#2E2822] transition-colors';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer ${baseClasses} ${className}`}
    >
      {inCart ? (
        <>
          <Check className="w-4 h-4 text-emerald-600" />
          <span>In Cart</span>
        </>
      ) : (
        <>
          {showIcon && <ShoppingBag className="w-4 h-4" />}
          <span>Add to Cart</span>
        </>
      )}
    </button>
  );
}
