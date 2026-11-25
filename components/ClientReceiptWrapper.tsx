'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { ReceiptItem } from './DynamicIslandReceipt';
import { ReceiptSkeleton } from './skeletons/ReceiptSkeleton';

const DynamicIslandReceipt = dynamic(
  () => import('./DynamicIslandReceipt').then((mod) => mod.DynamicIslandReceipt),
  {
    ssr: false,
    loading: () => <ReceiptSkeleton />,
  }
);

interface ClientReceiptWrapperProps {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: ReceiptItem[];
  totalAmount: number;
  dateStr?: string;
}

export function ClientReceiptWrapper(props: ClientReceiptWrapperProps) {
  return <DynamicIslandReceipt {...props} />;
}

export default ClientReceiptWrapper;
