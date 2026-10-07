import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full bg-white border-t border-gray-100 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="text-gray-900 font-bold text-lg tracking-tight">
          Studio Maya
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-gray-500">
          <Link href="/about" className="hover:text-black transition-colors">
            About Us
          </Link>
          <Link href="/contact" className="hover:text-black transition-colors">
            Contact
          </Link>
          <Link href="/about#terms" className="hover:text-black transition-colors">
            Terms & Conditions
          </Link>
        </div>

        <div className="text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} Studio Maya. All rights reserved.
        </div>
        
      </div>
    </footer>
  );
}
