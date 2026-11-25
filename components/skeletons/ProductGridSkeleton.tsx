import React from 'react';
import { Skeleton } from './Skeleton';
import { ProductCardSkeleton } from './ProductCardSkeleton';

interface ProductGridSkeletonProps {
  count?: number;
}

/**
 * ProductGridSkeleton: Displays a responsive grid of card skeletons with matching
 * filter category placeholders and accessible loading status.
 */
export function ProductGridSkeleton({ count = 6 }: ProductGridSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading systems catalog"
      className="scroll-mt-24"
    >
      <span className="sr-only">Loading StudioMaya systems catalog...</span>

      {/* Category Filter Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 pb-5 border-b border-[#C8B69A]/30">
        <div className="flex flex-wrap items-center gap-2">
          {['w-16', 'w-32', 'w-24', 'w-20', 'w-24'].map((widthClass, index) => (
            <Skeleton
              key={index}
              className={`h-8 ${widthClass} rounded-md bg-[#FAF8F5] border border-[#C8B69A]/30`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Skeleton className="w-3.5 h-3.5 rounded-full" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
      </div>

      {/* Responsive Grid matching ProductCatalog */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
        {Array.from({ length: count }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export default ProductGridSkeleton;
