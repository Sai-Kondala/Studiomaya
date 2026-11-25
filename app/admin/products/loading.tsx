import React from 'react';
import { AdminTableSkeleton } from '@/components/skeletons/AdminTableSkeleton';

export default function AdminProductsLoading() {
  return <AdminTableSkeleton title="Products" hasAddButton={true} rows={6} />;
}
