import React from 'react';
import { ProductDetailSkeleton } from '@/components/skeletons/ProductDetailSkeleton';
import { Navbar } from '@/components/Navbar';

export default function ProductLoading() {
  return (
    <>
      <Navbar />
      <ProductDetailSkeleton />
    </>
  );
}
