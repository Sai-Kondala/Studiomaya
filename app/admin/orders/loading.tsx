import React from 'react';
import { AdminTableSkeleton } from '@/components/skeletons/AdminTableSkeleton';

export default function AdminOrdersLoading() {
  return <AdminTableSkeleton title="Orders" rows={6} />;
}
