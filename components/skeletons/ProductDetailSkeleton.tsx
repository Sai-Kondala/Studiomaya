import React from 'react';
import { Skeleton } from './Skeleton';
import { ProductCardSkeleton } from './ProductCardSkeleton';

/**
 * ProductDetailSkeleton: Displays placeholder layout matching app/products/[id]/page.tsx
 * to eliminate cumulative layout shift during server product fetching.
 */
export function ProductDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading product details"
      className="min-h-screen bg-[#F7F4EF] text-[#171717] font-sans pb-24"
    >
      <span className="sr-only">Loading StudioMaya product details...</span>

      {/* Back to Catalogue Link Placeholder */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-4">
        <Skeleton className="h-4 w-44 rounded" />
      </div>

      {/* Product Details Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16 items-start mt-4">
        {/* Left Column: Image Gallery Placeholder */}
        <div className="space-y-4">
          <div className="bg-neutral-50/50 rounded-2xl border border-gray-200 overflow-hidden shadow-xs w-full h-[360px] sm:h-[420px] md:h-[480px] p-4 flex items-center justify-center">
            <Skeleton className="w-full h-full rounded-xl" />
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3].map((idx) => (
              <Skeleton key={idx} className="w-20 h-16 rounded-xl flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Right Column: Details & Actions Card Placeholder */}
        <div className="flex flex-col justify-center bg-[#FAF8F5] p-8 sm:p-10 rounded-2xl border border-[#C8B69A]/40 shadow-xs">
          {/* Category Tag */}
          <Skeleton className="h-5 w-28 rounded-md mb-4" />

          {/* Title */}
          <Skeleton className="h-9 sm:h-10 w-4/5 rounded mb-3" />

          {/* Rating */}
          <Skeleton className="h-4 w-48 rounded mb-6" />

          {/* Price */}
          <Skeleton className="h-10 w-32 rounded mb-6" />

          {/* Description */}
          <div className="space-y-2 mb-8">
            <Skeleton className="h-3.5 w-full rounded" />
            <Skeleton className="h-3.5 w-full rounded" />
            <Skeleton className="h-3.5 w-3/4 rounded" />
          </div>

          {/* Value Props Box */}
          <div className="space-y-3.5 mb-8 p-4 rounded-xl bg-[#F7F4EF] border border-[#C8B69A]/30">
            <div className="flex items-center gap-3">
              <Skeleton className="w-4 h-4 rounded-full shrink-0" />
              <Skeleton className="h-3.5 w-3/4 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="w-4 h-4 rounded-full shrink-0" />
              <Skeleton className="h-3.5 w-4/5 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="w-4 h-4 rounded-full shrink-0" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>
          </div>

          {/* Action Buttons: Add to Cart & Buy Now */}
          <div className="flex flex-col sm:flex-row gap-3.5 w-full">
            <Skeleton className="h-12 flex-1 rounded-md" />
            <Skeleton className="h-12 flex-1 rounded-md" />
          </div>

          <div className="flex justify-center mt-4">
            <Skeleton className="h-3 w-56 rounded" />
          </div>
        </div>
      </div>

      {/* Related Products Skeleton */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 mt-20 pt-16 border-t border-[#C8B69A]/30">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <Skeleton className="h-5 w-40 rounded mb-2" />
            <Skeleton className="h-8 w-60 rounded mb-1" />
            <Skeleton className="h-4 w-80 rounded" />
          </div>
          <Skeleton className="h-4 w-36 rounded" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7">
          {[1, 2, 3].map((idx) => (
            <ProductCardSkeleton key={idx} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default ProductDetailSkeleton;
