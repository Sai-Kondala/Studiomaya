'use client';

import { useState } from 'react';

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeImage, setActiveImage] = useState<string>(images[0] || '');

  if (images.length === 0) {
    return (
      <div className="bg-gray-100 rounded-2xl border border-gray-200 aspect-video flex items-center justify-center text-gray-400">
        No image available
      </div>
    );
  }

  const currentDisplayImage = activeImage || images[0];

  return (
    <div className="space-y-4">
      {/* Main Feature Image */}
      <div className="bg-neutral-50/50 rounded-2xl border border-gray-200 overflow-hidden shadow-sm w-full h-[360px] sm:h-[420px] md:h-[480px] flex items-center justify-center p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={currentDisplayImage} 
          alt={productName} 
          className="max-w-full max-h-full object-contain rounded-xl drop-shadow-xs transition-opacity duration-200" 
        />
      </div>

      {/* Thumbnails (only if multiple images) */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((img, idx) => {
            const isSelected = img === currentDisplayImage;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImage(img)}
                className={`w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer bg-neutral-50 flex items-center justify-center p-1 ${
                  isSelected 
                    ? 'border-black ring-2 ring-black/10 scale-105' 
                    : 'border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-400'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={img} 
                  alt={`${productName} thumbnail ${idx + 1}`} 
                  className="max-w-full max-h-full object-contain" 
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
