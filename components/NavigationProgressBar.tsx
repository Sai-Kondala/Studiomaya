'use client';

import React, { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type NavigationEvent = 'start' | 'done';
type Listener = (event: NavigationEvent) => void;

const listeners = new Set<Listener>();

/**
 * Trigger the global top loading progress bar programmatically.
 * Useful for button clicks, form submissions, and router.push transitions.
 */
export function startNavigationProgress() {
  listeners.forEach((fn) => fn('start'));
}

/**
 * Complete and hide the global top loading progress bar.
 */
export function stopNavigationProgress() {
  listeners.forEach((fn) => fn('done'));
}

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);

  const trickleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  const clearAllTimers = useCallback(() => {
    if (trickleTimerRef.current) clearInterval(trickleTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
  }, []);

  const start = useCallback(() => {
    clearAllTimers();
    isNavigatingRef.current = true;
    startTimeRef.current = Date.now();
    setVisible(true);
    setOpacity(1);

    // Instant jump so the user immediately gets visual confirmation upon click
    setProgress((prev) => (prev > 0 && prev < 80 ? prev : 24));

    // Smooth trickle progression
    trickleTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        if (prev < 40) return prev + Math.random() * 12 + 6;
        if (prev < 70) return prev + Math.random() * 8 + 3;
        if (prev < 88) return prev + Math.random() * 4 + 1.5;
        return prev + 0.4;
      });
    }, 200);

    // Safety timeout: automatically finish if navigation hangs for 12s
    safetyTimeoutRef.current = setTimeout(() => {
      done();
    }, 12000);
  }, [clearAllTimers]);

  const done = useCallback(() => {
    if (!isNavigatingRef.current && progress === 0) return;
    isNavigatingRef.current = false;
    clearAllTimers();

    // Ensure user perceives visual click feedback even on ultra-fast responses
    const elapsed = Date.now() - startTimeRef.current;
    const minDisplayTime = 160;
    const delay = Math.max(0, minDisplayTime - elapsed);

    finishTimerRef.current = setTimeout(() => {
      // Rush to 100%
      setProgress(100);

      // Fade out after completion
      finishTimerRef.current = setTimeout(() => {
        setOpacity(0);

        // Hide and reset
        resetTimerRef.current = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 250);
      }, 180);
    }, delay);
  }, [clearAllTimers, progress]);

  // Subscribe to external programmatic start/done calls
  useEffect(() => {
    const handleEvent: Listener = (event) => {
      if (event === 'start') {
        start();
      } else {
        done();
      }
    };

    listeners.add(handleEvent);
    return () => {
      listeners.delete(handleEvent);
    };
  }, [start, done]);

  // Automatically finish when Next.js route or searchParams changes
  useEffect(() => {
    done();
  }, [pathname, searchParams, done]);

  // Intercept all internal anchor clicks & history pushes to show progress immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Don't trigger progress if clicking standard non-navigating buttons
      if (target.closest('button:not([data-navigation="true"])')) {
        return;
      }

      // Check if click was inside an anchor tag
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (!href) return;

        // Ignore new tab, download, external, mailto, tel, or modifier keys
        if (
          anchor.target === '_blank' ||
          anchor.hasAttribute('download') ||
          anchor.getAttribute('rel')?.includes('external') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }

        try {
          const targetUrl = new URL(anchor.href, window.location.href);
          const currentUrl = new URL(window.location.href);

          // Same origin only
          if (targetUrl.origin !== currentUrl.origin) return;

          // Hash-only links on the same page (e.g. #catalog) - do not trigger
          if (
            targetUrl.pathname === currentUrl.pathname &&
            targetUrl.search === currentUrl.search &&
            targetUrl.hash
          ) {
            return;
          }

          // Exact same path and query
          if (
            targetUrl.pathname === currentUrl.pathname &&
            targetUrl.search === currentUrl.search
          ) {
            return;
          }

          // Start progress bar immediately
          start();
        } catch {
          // Ignore URL parsing errors
        }
        return;
      }

      // Check for elements marked with data-href or role="link"
      const clickableElement = target.closest('[data-href]');
      if (clickableElement) {
        start();
      }
    };

    const handlePopState = () => {
      start();
    };

    document.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('popstate', handlePopState);
      clearAllTimers();
    };
  }, [start, clearAllTimers]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999999] pointer-events-none"
      style={{
        opacity,
        transition: 'opacity 250ms ease-in-out',
      }}
      role="progressbar"
      aria-label="Navigation loading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      {/* Background tracking container */}
      <div className="relative w-full h-[3.5px] bg-transparent overflow-hidden">
        {/* Active Progress Bar */}
        <div
          className="h-full relative"
          style={{
            width: `${progress}%`,
            transition:
              progress === 100
                ? 'width 180ms ease-out'
                : progress <= 25
                ? 'width 100ms ease-out'
                : 'width 260ms cubic-bezier(0.1, 0.8, 0.2, 1)',
            background:
              'linear-gradient(90deg, #171717 0%, #5D4396 35%, #9E7D47 70%, #C8B69A 100%)',
            boxShadow:
              '0 1px 3px rgba(0, 0, 0, 0.25), 0 0 10px rgba(200, 182, 154, 0.85), 0 0 4px rgba(93, 67, 150, 0.6)',
          }}
        >
          {/* Luminous leading head/glow */}
          <div
            className="absolute right-0 top-[-2px] bottom-[-2px] w-[80px]"
            style={{
              background:
                'radial-gradient(ellipse at right, rgba(200, 182, 154, 1) 0%, rgba(93, 67, 150, 0.6) 50%, transparent 80%)',
              boxShadow: '0 0 12px #C8B69A, 0 0 6px #5D4396',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function NavigationProgressBar() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
