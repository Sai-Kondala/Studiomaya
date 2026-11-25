import React from 'react';
import { Skeleton } from './Skeleton';

interface OrderListSkeletonProps {
  count?: number;
}

/**
 * OrderListSkeleton: Displays placeholder order cards matching account orders page.
 */
export function OrderListSkeleton({ count = 3 }: OrderListSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading purchases"
      className="space-y-6"
    >
      <span className="sr-only">Loading your purchases...</span>

      {/* Header bar placeholder */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-48 rounded mb-1" />
          <Skeleton className="h-4 w-72 rounded" />
        </div>
        <Skeleton className="h-4 w-28 rounded" />
      </div>

      {/* Order Cards List */}
      <div className="space-y-6">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden"
          >
            {/* Order Card Header */}
            <div className="bg-gray-50/70 p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <Skeleton className="h-3 w-20 rounded mb-1" />
                  <Skeleton className="h-4 w-28 rounded" />
                </div>
                <div className="border-l border-gray-200 pl-4">
                  <Skeleton className="h-3 w-20 rounded mb-1" />
                  <Skeleton className="h-4 w-32 rounded" />
                </div>
                <div className="border-l border-gray-200 pl-4">
                  <Skeleton className="h-3 w-20 rounded mb-1" />
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
              </div>

              <div>
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            </div>

            {/* Order Item Row */}
            <div className="p-6 divide-y divide-gray-100">
              <div className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-44 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-4 w-16 rounded" />
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  <Skeleton className="h-10 flex-1 sm:flex-none w-28 rounded-xl" />
                  <Skeleton className="h-10 flex-1 sm:flex-none w-28 rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OrderListSkeleton;
