import React from 'react';
import { OrderListSkeleton } from '@/components/skeletons/OrderListSkeleton';

export default function CustomerOrdersLoading() {
  return <OrderListSkeleton count={4} />;
}
