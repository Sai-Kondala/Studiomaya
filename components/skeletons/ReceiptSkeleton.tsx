import React from 'react';
import { Skeleton } from './Skeleton';

/**
 * ReceiptSkeleton: Placeholder for the thermal receipt printer on the thank-you page.
 */
export function ReceiptSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading order receipt"
      className="w-full max-w-sm mx-auto my-6 bg-white rounded-3xl p-6 border border-gray-100 shadow-md space-y-4"
    >
      <span className="sr-only">Preparing your verified order receipt...</span>

      {/* Header */}
      <div className="text-center space-y-2 pb-4 border-b border-dashed border-gray-200">
        <Skeleton className="w-8 h-8 rounded-lg mx-auto" />
        <Skeleton className="h-5 w-32 rounded mx-auto" />
        <Skeleton className="h-3 w-44 rounded mx-auto" />
      </div>

      {/* Order Details */}
      <div className="space-y-3 py-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      </div>

      {/* Items Breakdown */}
      <div className="pt-2 border-t border-dashed border-gray-200 space-y-3">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
          <Skeleton className="h-4 w-14 rounded" />
        </div>
      </div>

      {/* Total & Action */}
      <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-6 w-24 rounded" />
      </div>

      <Skeleton className="h-12 w-full rounded-xl mt-4" />
    </div>
  );
}

export default ReceiptSkeleton;
