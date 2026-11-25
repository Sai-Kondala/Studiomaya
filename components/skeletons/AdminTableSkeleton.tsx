import React from 'react';
import { Skeleton } from './Skeleton';

interface AdminTableSkeletonProps {
  title: string;
  hasAddButton?: boolean;
  rows?: number;
}

/**
 * AdminTableSkeleton: Renders a structured placeholder for admin management tables
 * (Orders, Products, Customers).
 */
export function AdminTableSkeleton({
  title,
  hasAddButton = false,
  rows = 5,
}: AdminTableSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={`Loading admin ${title}`}
      className="p-8 max-w-6xl mx-auto space-y-8"
    >
      <span className="sr-only">Loading admin {title}...</span>

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {hasAddButton && <Skeleton className="h-9 w-28 rounded-lg" />}
      </div>

      {/* Table Container */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>

        <div className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="p-4.5 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="w-10 h-10 rounded-md shrink-0" />
                <div className="space-y-1.5 flex-1 max-w-xs">
                  <Skeleton className="h-4 w-4/5 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>

              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminTableSkeleton;
