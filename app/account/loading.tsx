import React from 'react';
import { Skeleton } from '@/components/skeletons/Skeleton';
import { OrderListSkeleton } from '@/components/skeletons/OrderListSkeleton';

export default function AccountLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading account details"
      className="space-y-8"
    >
      <span className="sr-only">Loading your account information...</span>

      {/* Welcome Card & Metrics Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-[#FAF8F5] rounded-2xl p-8 border border-[#C8B69A]/35 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <Skeleton className="h-3 w-28 rounded mb-2" />
            <Skeleton className="h-8 w-60 rounded mb-2" />
            <Skeleton className="h-4 w-80 rounded" />
          </div>
          <div className="pt-4 border-t border-[#C8B69A]/20">
            <Skeleton className="h-4 w-40 rounded" />
          </div>
        </div>

        <div className="bg-[#FAF8F5] rounded-2xl p-8 border border-[#C8B69A]/35 shadow-xs flex flex-col justify-center space-y-4">
          <Skeleton className="h-3 w-32 rounded" />
          <Skeleton className="h-9 w-20 rounded" />
          <Skeleton className="h-4 w-44 rounded" />
        </div>
      </div>

      {/* Orders List Skeleton */}
      <OrderListSkeleton count={2} />
    </div>
  );
}
