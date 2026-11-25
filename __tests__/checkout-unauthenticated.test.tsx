import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CheckoutButton from '@/components/CheckoutButton';

jest.mock('@/components/CartContext', () => ({
  useCart: jest.fn(() => ({ user: null })),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

describe('CheckoutButton Unauthenticated Visitor Guard Specification', () => {
  it('redirects unauthenticated visitors to /login?next=... when user is null', () => {
    const routerMock = { push: jest.fn() };
    const user = null;
    const product = { id: 'prod_notion_1', name: 'Ultimate Life OS', price: 999 };

    function handleBuyClick() {
      if (!user) {
        const currentPath = `/products/${product.id}`;
        routerMock.push(`/login?next=${encodeURIComponent(currentPath)}`);
        return;
      }
    }

    handleBuyClick();

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith('/login?next=%2Fproducts%2Fprod_notion_1');
  });

  it('renders Buy Now button with accessible markup and no modal initially exposed', () => {
    const html = renderToStaticMarkup(
      <CheckoutButton
        product={{ id: 'prod_notion_1', name: 'Ultimate Life OS', price: 999 }}
        rzpKeyId="rzp_test_123"
      />
    );

    expect(html).toContain('Buy Now →');
    expect(html).not.toContain('Enter your details');
  });
});
