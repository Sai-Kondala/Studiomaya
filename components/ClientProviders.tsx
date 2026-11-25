'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { CartProvider } from './CartContext';
import { AuthRedirectHandler } from './AuthRedirectHandler';
import { NavigationProgressBar } from './NavigationProgressBar';

const CartDrawer = dynamic(() => import('./CartDrawer').then((mod) => mod.CartDrawer), {
  ssr: false,
});

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <NavigationProgressBar />
      <AuthRedirectHandler />
      {children}
      <CartDrawer />
    </CartProvider>
  );
}
