import React from 'react';
import { AdminTableSkeleton } from '@/components/skeletons/AdminTableSkeleton';

export default function AdminCustomersLoading() {
  return <AdminTableSkeleton title="Customers" rows={6} />;
}
