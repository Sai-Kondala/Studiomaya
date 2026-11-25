import React from 'react';
import { Skeleton } from './Skeleton';

/**
 * AdminDashboardSkeleton: Placeholder state for admin overview analytics.
 */
export function AdminDashboardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading admin dashboard"
      className="p-8 max-w-6xl mx-auto space-y-8"
    >
      <span className="sr-only">Loading admin dashboard...</span>

      <div>
        <Skeleton className="h-8 w-56 rounded mb-2" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-3">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-8 w-36 rounded" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
        ))}
      </div>

      {/* Analytics Chart & Top Products Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Chart Skeleton */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
          <Skeleton className="h-6 w-36 rounded" />
          <div className="h-64 flex items-end justify-between gap-2 pt-6">
            {[40, 65, 30, 80, 55, 90, 75, 60, 85, 50, 70, 95].map((heightPct, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <Skeleton className="w-full rounded-t" style={{ height: `${heightPct}%` }} />
                <Skeleton className="h-3 w-6 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Top Products Box */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <Skeleton className="h-6 w-32 rounded" />
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="py-3 flex justify-between items-center">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardSkeleton;
