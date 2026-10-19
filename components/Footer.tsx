import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full bg-[#F7F4EF] border-t border-[#C8B69A]/30 py-12 mt-auto">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Brand: Boxed Monogram + Wordmark */}
        <div className="flex items-center">
          <div className="w-8 h-8 border border-[#C8B69A]/70 bg-[#FAF8F5] flex items-center justify-center font-serif text-base font-bold text-[#171717]">
            M
          </div>
          <div className="pl-3">
            <span className="font-serif text-sm tracking-[0.22em] font-semibold text-[#171717] uppercase">
              StudioMaya
            </span>
          </div>
        </div>
        
        {/* Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-8 text-xs font-medium uppercase tracking-[0.14em] text-[#171717]/70">
          <Link href="/about" className="hover:text-[#171717] transition-colors">
            About Us
          </Link>
          <Link href="/contact" className="hover:text-[#171717] transition-colors">
            Contact
          </Link>
          <Link href="/about#terms" className="hover:text-[#171717] transition-colors">
            Terms &amp; Conditions
          </Link>
        </div>

        {/* Copyright */}
        <div className="text-[#171717]/50 text-xs font-mono tracking-wider">
          &copy; {new Date().getFullYear()} StudioMaya. All rights reserved.
        </div>
        
      </div>
    </footer>
  );
}
