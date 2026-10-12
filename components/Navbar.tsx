'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from './CartContext';
import { ShoppingBag, User, LogOut, Menu, X, Package } from 'lucide-react';

export function Navbar() {
  const { cart, setIsCartOpen, user, isUserLoading, logout } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-30 transition-all">
      <div className="flex justify-between items-center py-4 px-6 sm:px-8 max-w-6xl mx-auto">
        {/* Brand */}
        <Link href="/" className="font-extrabold text-xl flex items-center gap-2.5 tracking-tight text-gray-950 group">
          <div className="w-6 h-6 bg-black rounded-lg transition-transform group-hover:scale-105" />
          <span>Studio Maya</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-black transition-colors">
            Products
          </Link>
          <Link href="/#categories" className="hover:text-black transition-colors">
            Categories
          </Link>
          <Link href="/about" className="hover:text-black transition-colors">
            About
          </Link>
          {user && (
            <Link href="/account/orders" className="hover:text-black transition-colors flex items-center gap-1.5">
              <Package className="w-4 h-4 text-gray-400" />
              <span>My Purchases</span>
            </Link>
          )}
        </div>

        {/* Right Section: Auth & Cart */}
        <div className="flex items-center gap-3">
          {/* Auth State (Desktop) */}
          <div className="hidden md:flex items-center gap-3">
            {isUserLoading ? (
              <div className="w-16 h-8 bg-gray-100 rounded-xl animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className="flex items-center gap-2 py-1.5 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="max-w-[120px] truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                </button>

                {accountMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-1 text-sm"
                    onMouseLeave={() => setAccountMenuOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500 truncate">
                      {user.email}
                    </div>
                    <Link
                      href="/account"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      Dashboard Overview
                    </Link>
                    <Link
                      href="/account/orders"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      My Purchases
                    </Link>
                    <button
                      onClick={() => {
                        setAccountMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 font-medium flex items-center gap-2 border-t border-gray-100 mt-1"
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
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-black transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="px-3.5 py-1.5 text-xs font-semibold bg-black text-white rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Cart Trigger */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="p-2.5 hover:bg-gray-100 rounded-xl relative transition-colors text-gray-700 hover:text-black flex items-center justify-center"
            aria-label="View shopping cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                {cart.length}
              </span>
            )}
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-black rounded-lg"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 px-6 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 text-sm">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-gray-700 font-medium hover:text-black"
          >
            Products
          </Link>
          <Link
            href="/#categories"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-gray-700 font-medium hover:text-black"
          >
            Categories
          </Link>
          <Link
            href="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-gray-700 font-medium hover:text-black"
          >
            About
          </Link>

          <div className="pt-3 border-t border-gray-100">
            {user ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-400">Signed in as {user.email}</div>
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 font-semibold text-black"
                >
                  Account Dashboard
                </Link>
                <Link
                  href="/account/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 font-semibold text-black"
                >
                  My Purchases
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="block py-2 text-red-600 font-medium"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2.5 bg-black text-white rounded-xl text-xs font-semibold"
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
