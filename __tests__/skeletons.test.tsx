import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Skeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  ProductDetailSkeleton,
  OrderListSkeleton,
  CartSkeleton,
  AdminDashboardSkeleton,
  AdminTableSkeleton,
} from '@/components/skeletons';
import { ReceiptSkeleton } from '@/components/skeletons/ReceiptSkeleton';

describe('StudioMaya Premium Skeleton Loading System (Server & SSR Compatible)', () => {
  describe('Skeleton Primitive', () => {
    it('renders with skeleton-shimmer class and aria-hidden="true"', () => {
      const html = renderToStaticMarkup(<Skeleton className="h-6 w-24" />);
      expect(html).toContain('skeleton-shimmer');
      expect(html).toContain('h-6');
      expect(html).toContain('w-24');
      expect(html).toContain('aria-hidden="true"');
    });
  });

  describe('ProductCardSkeleton', () => {
    it('renders card skeleton with matching dimensions, badge, and price placeholders', () => {
      const html = renderToStaticMarkup(<ProductCardSkeleton />);
      expect(html).toContain('bg-[#FAF8F5]');
      expect(html).toContain('rounded-2xl');
      expect(html).toContain('skeleton-shimmer');
      expect(html).toContain('aspect-[16/11]');
    });
  });

  describe('ProductGridSkeleton', () => {
    it('renders accessible loading region with screen reader announcement and matching grid', () => {
      const html = renderToStaticMarkup(<ProductGridSkeleton count={6} />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading systems catalog"');
      expect(html).toContain('sr-only');
      expect(html).toContain('Loading StudioMaya systems catalog...');
      expect(html).toContain('grid-cols-1 md:grid-cols-2 lg:grid-cols-3');
    });
  });

  describe('ProductDetailSkeleton', () => {
    it('renders accessible product details placeholder matching layout', () => {
      const html = renderToStaticMarkup(<ProductDetailSkeleton />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading product details"');
      expect(html).toContain('sr-only');
      expect(html).toContain('Loading StudioMaya product details...');
    });
  });

  describe('OrderListSkeleton', () => {
    it('renders accessible purchases placeholder matching orders list', () => {
      const html = renderToStaticMarkup(<OrderListSkeleton count={3} />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading purchases"');
      expect(html).toContain('sr-only');
      expect(html).toContain('Loading your purchases...');
    });
  });

  describe('CartSkeleton', () => {
    it('renders accessible shopping cart placeholder for page view', () => {
      const html = renderToStaticMarkup(<CartSkeleton layout="page" />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading shopping cart"');
      expect(html).toContain('sr-only');
    });

    it('renders accessible cart drawer placeholder for drawer view', () => {
      const html = renderToStaticMarkup(<CartSkeleton layout="drawer" />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading cart"');
    });
  });

  describe('AdminDashboardSkeleton & AdminTableSkeleton', () => {
    it('renders accessible dashboard skeleton with metrics and charts', () => {
      const html = renderToStaticMarkup(<AdminDashboardSkeleton />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading admin dashboard"');
    });

    it('renders accessible table skeleton with customized title', () => {
      const html = renderToStaticMarkup(<AdminTableSkeleton title="Orders" rows={5} />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-label="Loading admin Orders"');
      expect(html).toContain('Orders');
    });
  });

  describe('ReceiptSkeleton', () => {
    it('renders thermal receipt placeholder with accessible label', () => {
      const html = renderToStaticMarkup(<ReceiptSkeleton />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading order receipt"');
    });
  });
});
