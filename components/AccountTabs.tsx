'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AccountTabs() {
  const pathname = usePathname();

  const isPurchases = pathname?.startsWith('/account/orders');
  const isOverview = !isPurchases;

  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-2xl w-fit">
      <Link
        href="/account"
        aria-current={isOverview ? 'page' : undefined}
        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
          isOverview
            ? 'bg-white text-black shadow-xs font-semibold'
            : 'text-gray-600 hover:text-black hover:bg-white/60 hover:shadow-xs'
        }`}
      >
        Overview
      </Link>
      <Link
        href="/account/orders"
        aria-current={isPurchases ? 'page' : undefined}
        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
          isPurchases
            ? 'bg-white text-black shadow-xs font-semibold'
            : 'text-gray-600 hover:text-black hover:bg-white/60 hover:shadow-xs'
        }`}
      >
        My Purchases
      </Link>
    </div>
  );
}
