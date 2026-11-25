'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { startNavigationProgress } from '@/components/NavigationProgressBar';

interface ClickableCardProps extends React.HTMLAttributes<HTMLDivElement> {
  href: string;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * ClickableCard makes an entire product card container interactive.
 * - Navigates to `href` on click, Space, or Enter.
 * - Supports Ctrl+Click, Cmd+Click, and Middle-Click to open in a new tab.
 * - Safely ignores clicks originating on buttons (e.g. AddToCartButton) so
 *   nested interactive controls never trigger unintended card navigation.
 * - Automatically triggers the brand-aligned global loading progress bar.
 */
export function ClickableCard({
  href,
  children,
  className = '',
  ariaLabel,
  ...props
}: ClickableCardProps) {
  const router = useRouter();

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;

    // 1. If click was inside a button (e.g. AddToCartButton), do not navigate
    if (target?.closest('button')) {
      return;
    }

    // 2. If click was on an anchor tag, let the anchor handle it naturally
    // (NavigationProgressBar's capture listener already starts the progress bar)
    if (target?.closest('a')) {
      return;
    }

    // 3. Modifier / Middle click: Open in new tab
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) {
      window.open(href, '_blank');
      return;
    }

    // 4. Regular card click: start loading progress and navigate to product view
    startNavigationProgress();
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Only trigger if keyboard focus is directly on the card itself,
    // not on an internal interactive element (e.g. AddToCart button or link)
    if (e.target !== e.currentTarget) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startNavigationProgress();
      router.push(href);
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      data-href={href}
      aria-label={ariaLabel}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer transition-all duration-200 active:scale-[0.995] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
