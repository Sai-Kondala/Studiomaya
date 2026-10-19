'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartContext';
import { ShoppingBag, User, LogOut, Menu, X, Package } from 'lucide-react';

export function Navbar() {
  const { cart, setIsCartOpen, user, isUserLoading, isHydrated, logout } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  return (
    <nav className="border-b border-[#C8B69A]/30 bg-[#F7F4EF]/85 backdrop-blur-md sticky top-0 z-50 transition-all">
      <div className="flex justify-between items-center py-3.5 px-6 sm:px-8 max-w-6xl mx-auto">
        {/* Brand: Boxed Monogram + Editorial Wordmark */}
        <Link href="/" className="flex items-center group cursor-pointer select-none">
          <div className="w-9 h-9 border border-[#C8B69A]/70 bg-[#FAF8F5] flex items-center justify-center font-serif text-lg font-bold text-[#171717] group-hover:border-[#171717] group-hover:bg-white transition-all shadow-2xs">
            M
          </div>
          <div className="pl-3.5 flex flex-col justify-center">
            <span className="font-serif text-[15px] sm:text-base tracking-[0.24em] font-semibold text-[#171717] uppercase">
              StudioMaya
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center space-x-8 text-xs font-medium tracking-[0.14em] uppercase text-[#171717]/75">
          <Link href="/#catalog" className="hover:text-[#171717] transition-colors">
            Products
          </Link>
          <Link href="/#catalog" className="hover:text-[#171717] transition-colors">
            Categories
          </Link>
          <Link href="/about" className="hover:text-[#171717] transition-colors">
            About
          </Link>
          {user && (
            <Link href="/account/orders" className="hover:text-[#171717] transition-colors flex items-center gap-1.5 normal-case tracking-normal text-xs font-semibold text-[#171717]/80">
              <Package className="w-3.5 h-3.5 text-[#C8B69A]" />
              <span>My Purchases</span>
            </Link>
          )}
        </div>

        {/* Right Section: Auth & Cart */}
        <div className="flex items-center gap-3">
          {/* Auth State (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            {isUserLoading ? (
              <div className="w-16 h-8 bg-[#C8B69A]/20 rounded-md animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className="flex items-center gap-2 py-1.5 px-3 rounded-md border border-[#C8B69A]/60 bg-[#FAF8F5]/80 hover:bg-[#FAF8F5] text-xs font-medium text-[#171717] transition-colors cursor-pointer shadow-2xs"
                >
                  <User className="w-3.5 h-3.5 text-[#C8B69A]" />
                  <span className="max-w-[120px] truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                </button>

                {accountMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-52 bg-[#FAF8F5] rounded-xl shadow-xl border border-[#C8B69A]/40 py-2 z-50 animate-in fade-in slide-in-from-top-1 text-xs"
                    onMouseLeave={() => setAccountMenuOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-[#C8B69A]/20 text-[11px] text-[#171717]/60 truncate font-mono">
                      {user.email}
                    </div>
                    <Link
                      href="/account"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2 text-[#171717] hover:bg-[#F3EFEA] font-medium"
                    >
                      Dashboard Overview
                    </Link>
                    <Link
                      href="/account/orders"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2 text-[#171717] hover:bg-[#F3EFEA] font-medium"
                    >
                      My Purchases
                    </Link>
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-red-700 hover:bg-red-50/80 font-medium flex items-center gap-2 border-t border-[#C8B69A]/20 mt-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs font-medium tracking-wider uppercase text-[#171717]/80 hover:text-[#171717] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="px-3.5 py-1.5 text-xs font-medium tracking-wider uppercase bg-[#171717] text-[#F7F4EF] rounded-md hover:bg-[#2E2822] transition-colors shadow-2xs"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Cart Trigger: Editorial Bordered Pill */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="px-3.5 py-1.5 border border-[#C8B69A]/70 hover:border-[#171717] bg-[#FAF8F5]/90 hover:bg-[#FAF8F5] rounded-md text-xs tracking-wider uppercase font-medium text-[#171717] flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
            aria-label="View shopping cart"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#171717]/70" />
            <span>Cart ({isHydrated ? cart.length : 0})</span>
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#171717]/80 hover:text-[#171717] rounded-md border border-[#C8B69A]/40 bg-[#FAF8F5] cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#FAF8F5]/98 backdrop-blur-md border-b border-[#C8B69A]/30 px-6 py-5 space-y-3.5 animate-in fade-in slide-in-from-top-2 text-xs uppercase tracking-wider">
          <Link
            href="/#catalog"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#171717] font-medium hover:text-[#C8B69A]"
          >
            Products
          </Link>
          <Link
            href="/#catalog"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#171717] font-medium hover:text-[#C8B69A]"
          >
            Categories
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#171717] font-medium hover:text-[#C8B69A]"
          >
            About
          </Link>

          <div className="pt-4 border-t border-[#C8B69A]/30 normal-case tracking-normal">
            {user ? (
              <div className="space-y-2">
                <div className="text-[11px] text-[#171717]/60 font-mono">Signed in as {user.email}</div>
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-1.5 font-semibold text-[#171717]"
                >
                  Account Dashboard
                </Link>
                <Link
                  href="/account/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-1.5 font-semibold text-[#171717]"
                >
                  My Purchases
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="block py-1.5 text-red-700 font-medium cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2.5 border border-[#C8B69A]/70 rounded-md text-xs font-semibold uppercase tracking-wider text-[#171717]"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2.5 bg-[#171717] text-[#F7F4EF] rounded-md text-xs font-semibold uppercase tracking-wider"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
