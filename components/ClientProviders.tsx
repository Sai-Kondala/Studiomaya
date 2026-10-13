'use client';

import React from 'react';
import { CartProvider } from './CartContext';
import { CartDrawer } from './CartDrawer';
import { AuthRedirectHandler } from './AuthRedirectHandler';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <AuthRedirectHandler />
      {children}
      <CartDrawer />
    </CartProvider>
  );
}

