'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeImage, setActiveImage] = useState<string>(images[0] || '');
  const [unoptimizedImages, setUnoptimizedImages] = useState<Record<string, boolean>>({});

  if (images.length === 0) {
    return (
      <div className="bg-gray-100 rounded-2xl border border-gray-200 aspect-video flex items-center justify-center text-gray-400">
        No image available
      </div>
    );
  }

  const currentDisplayImage = activeImage || images[0];

  const handleImageError = (imgSrc: string) => {
    setUnoptimizedImages((prev) => ({ ...prev, [imgSrc]: true }));
  };

  return (
    <div className="space-y-4">
      {/* Main Feature Image (Above the fold - prioritized) */}
      <div className="relative bg-neutral-50/50 rounded-2xl border border-gray-200 overflow-hidden shadow-xs w-full h-[360px] sm:h-[420px] md:h-[480px] flex items-center justify-center p-3">
        <Image 
          src={currentDisplayImage} 
          alt={productName} 
          fill
          priority
          loading="eager"
          sizes="(max-width: 768px) 100vw, 550px"
          className="object-contain p-3 rounded-xl drop-shadow-xs transition-opacity duration-200" 
          unoptimized={Boolean(unoptimizedImages[currentDisplayImage])}
          onError={() => handleImageError(currentDisplayImage)}
        />
      </div>

      {/* Thumbnails (Lazy loaded) */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((img, idx) => {
            const isSelected = img === currentDisplayImage;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImage(img)}
                className={`relative w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer bg-neutral-50 flex items-center justify-center p-1 ${
                  isSelected 
                    ? 'border-black ring-2 ring-black/10 scale-105' 
                    : 'border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-400'
                }`}
              >
                <Image 
                  src={img} 
                  alt={`${productName} thumbnail ${idx + 1}`} 
                  fill
                  sizes="80px"
                  className="object-contain p-1" 
                  loading="lazy"
                  decoding="async"
                  unoptimized={Boolean(unoptimizedImages[img])}
                  onError={() => handleImageError(img)}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
