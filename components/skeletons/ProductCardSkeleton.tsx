import React from 'react';
import { Skeleton } from './Skeleton';

/**
 * ProductCardSkeleton: Perfectly mirrors the dimensions, spacing, and aspect ratio
 * of product cards in ProductCatalog to prevent Cumulative Layout Shift (CLS).
 */
export function ProductCardSkeleton() {
  return (
    <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#C8B69A]/40 flex flex-col relative">
      {/* Product Preview Image Skeleton */}
      <div className="relative overflow-hidden rounded-xl aspect-[16/11] bg-[#EAE6DF] mb-4.5 border border-[#C8B69A]/20">
        <Skeleton className="w-full h-full rounded-xl" />

        {/* Top-left category pill badge placeholder */}
        <div className="absolute top-2.5 left-2.5">
          <Skeleton className="h-4 w-20 rounded-md bg-[#FAF8F5]/80" />
        </div>

        {/* Top-right rating pill badge placeholder */}
        <div className="absolute top-2.5 right-2.5">
          <Skeleton className="h-4 w-12 rounded-md bg-[#FAF8F5]/80" />
        </div>
      </div>

      {/* Card Meta & Details */}
      <div className="flex flex-col flex-1 px-1">
        {/* System code tag placeholder */}
        <Skeleton className="h-2.5 w-24 rounded mb-2" />

        {/* Product title placeholder */}
        <Skeleton className="h-5 w-4/5 rounded mb-2" />

        {/* Rating & reviews placeholder */}
        <Skeleton className="h-3 w-28 rounded mb-2.5" />

        {/* Short description placeholder */}
        <Skeleton className="h-3 w-full rounded mb-1.5" />
        <Skeleton className="h-3 w-3/4 rounded mb-4" />

        {/* Bottom bar: Price & Action Buttons */}
        <div className="mt-auto pt-3.5 border-t border-[#C8B69A]/30 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>

          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductCardSkeleton;
