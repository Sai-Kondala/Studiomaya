import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base Skeleton primitive for StudioMaya.
 * Applies subtle neutral shimmer placeholder styling that blends with the warm ivory/soft beige palette.
 * Screen readers treat this as decorative (aria-hidden="true").
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-md ${className}`}
      {...props}
    />
  );
}

export default Skeleton;
