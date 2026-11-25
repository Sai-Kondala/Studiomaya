import React from 'react';
import { Skeleton } from './Skeleton';

interface CartSkeletonProps {
  layout?: 'drawer' | 'page';
}

/**
 * CartSkeleton: Displays a smooth placeholder state for cart drawer and cart page.
 */
export function CartSkeleton({ layout = 'page' }: CartSkeletonProps) {
  if (layout === 'drawer') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading cart"
        className="flex flex-col h-full p-6 space-y-4"
      >
        <span className="sr-only">Loading your cart items...</span>

        {/* Items */}
        <div className="space-y-4 flex-1 overflow-y-auto">
          {[1, 2].map((idx) => (
            <div key={idx} className="flex gap-3 pb-3 border-b border-[#C8B69A]/20">
              <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom summary & action */}
        <div className="space-y-3 pt-4 border-t border-[#C8B69A]/30">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading shopping cart"
      className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start"
    >
      <span className="sr-only">Loading shopping cart...</span>

      {/* Cart items list */}
      <div className="md:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs divide-y divide-gray-100">
        {[1, 2].map((idx) => (
          <div key={idx} className="py-5 first:pt-0 last:pb-0 flex gap-4 items-center">
            <Skeleton className="w-20 h-20 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Cart summary box */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-xs space-y-6">
        <Skeleton className="h-6 w-28 rounded" />
        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-6 w-20 rounded" />
        </div>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default CartSkeleton;
