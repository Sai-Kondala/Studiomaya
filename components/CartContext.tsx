'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url: string;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  user: User | null;
  isUserLoading: boolean;
  syncCartAfterLogin: () => Promise<void>;
  logout: () => Promise<void>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCart = localStorage.getItem('digital-store-cart');
        if (savedCart) {
          return JSON.parse(savedCart);
        }
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }
    return [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  // Persist local cart to localStorage
  useEffect(() => {
    localStorage.setItem('digital-store-cart', JSON.stringify(cart));
  }, [cart]);

  // 3. Sync anonymous cart with server on login
  const syncCartAfterLogin = useCallback(async () => {
    try {
      const rawLocal = localStorage.getItem('digital-store-cart');
      let localItems: CartItem[] = [];
      if (rawLocal) {
        try {
          localItems = JSON.parse(rawLocal);
        } catch {
          // ignore parsing error
        }
      }

      const productIds = localItems.map((item) => item.id);

      const res = await fetch('/api/cart/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          setCart(data.items);
          localStorage.setItem('digital-store-cart', JSON.stringify(data.items));
        }
      }
    } catch (err) {
      console.warn('Failed to sync cart after login:', err);
    }
  }, []);

  // 4. Supabase auth listener and cart hydration
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Check initial user
    const checkInitialUser = async () => {
      try {
        const {
          data: { user: initialUser },
        } = await supabase.auth.getUser();
        setUser(initialUser || null);
        setIsUserLoading(false);
        if (initialUser) {
          syncCartAfterLogin();
        }
      } catch {
        setIsUserLoading(false);
      }
    };
    checkInitialUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      setIsUserLoading(false);

      if (event === 'SIGNED_IN' && currentUser) {
        await syncCartAfterLogin();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [syncCartAfterLogin]);

  const addToCart = (item: CartItem) => {
    setCart((prevCart) => {
      // Prevent duplicate product entries
      if (prevCart.some((cartItem) => cartItem.id === item.id)) {
        return prevCart;
      }
      return [...prevCart, item];
    });
    setIsCartOpen(true);

    // If authenticated, persist to Supabase in the background
    if (user) {
      fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', productId: item.id }),
      }).catch((err) => console.warn('Background cart add failed:', err));
    }
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));

    // If authenticated, remove from Supabase
    if (user) {
      fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', productId: id }),
      }).catch((err) => console.warn('Background cart remove failed:', err));
    }
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('digital-store-cart');

    // If authenticated, clear in Supabase
    if (user) {
      fetch('/api/cart', {
        method: 'DELETE',
      }).catch((err) => console.warn('Background cart clear failed:', err));
    }
  };

  const logout = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      setUser(null);
      clearCart();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        user,
        isUserLoading,
        syncCartAfterLogin,
        logout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
