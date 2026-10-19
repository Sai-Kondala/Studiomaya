'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { AddToCartButton } from '@/components/AddToCartButton';
import { getProductPrimaryImage } from '@/lib/productUtils';
import { Sparkles, Layers, ArrowRight } from 'lucide-react';

export interface ProductItem {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  price: number;
  original_price?: number;
  category?: string;
  image_url?: string | string[];
  status?: string;
  created_at?: string;
}

interface ProductCatalogProps {
  initialProducts: ProductItem[];
}

const CATEGORIES = ['All', 'Notion Templates', 'Productivity', 'Study', 'Finance'];

export function ProductCatalog({ initialProducts }: ProductCatalogProps) {
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'All') return initialProducts;
    return initialProducts.filter((product) => {
      const cat = (product.category || '').toLowerCase();
      const target = activeCategory.toLowerCase();
      if (target === 'notion templates') {
        return cat.includes('notion') || cat === '';
      }
      return cat.includes(target);
    });
  }, [initialProducts, activeCategory]);

  return (
    <div id="catalog" className="scroll-mt-24">
      {/* Category Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 pb-5 border-b border-[#C8B69A]/30">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-md text-xs font-medium uppercase tracking-[0.14em] transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#171717] text-[#F7F4EF] shadow-2xs'
                    : 'bg-[#FAF8F5] text-[#171717]/70 hover:text-[#171717] border border-[#C8B69A]/45 hover:border-[#171717]'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono uppercase tracking-wider text-[#171717]/50 flex items-center gap-1.5 self-start sm:self-auto">
          <Layers className="w-3.5 h-3.5 text-[#C8B69A]" />
          <span>Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'system' : 'systems'}</span>
        </div>
      </div>

      {/* Product Cards Grid: Editorial Layout inspired by reference */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
        {filteredProducts.map((product, index) => {
          const primaryImage = getProductPrimaryImage(product.image_url);
          const hasDiscount = product.original_price && product.original_price > product.price;
          const discountPct = hasDiscount
            ? Math.round(((product.original_price! - product.price) / product.original_price!) * 100)
            : 0;

          const itemCode = `NOTION SYSTEM — 0${index + 1}`;

          return (
            <div
              key={product.id}
              className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#C8B69A]/40 hover:border-[#C8B69A]/90 editorial-card flex flex-col group relative transition-all"
            >
              {/* Product Preview Image */}
              <Link
                href={`/products/${product.id}`}
                className="block relative overflow-hidden rounded-xl aspect-[16/11] bg-[#EFECE6] mb-4.5 group/img border border-[#C8B69A]/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={primaryImage || '/hero_3d.jpg'}
                  alt={product.name}
                  className="w-full h-full object-cover transform group-hover/img:scale-[1.03] transition-transform duration-700 ease-out"
                />

                {/* Badge: Category / Status */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-widest font-semibold bg-[#FAF8F5]/95 backdrop-blur-md text-[#7A6953] border border-[#C8B69A]/50 shadow-2xs">
                    {product.category || 'Notion OS'}
                  </span>
                </div>

                {/* Rating Badge */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/95 backdrop-blur-md text-[#171717] shadow-2xs border border-black/5">
                    <span className="text-amber-600">★</span> 5.0
                  </span>
                </div>
              </Link>

              {/* Card Meta & Details */}
              <div className="flex flex-col flex-1 px-1">
                {/* Reference Tag: NOTION SYSTEM — 01 */}
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#7A6953] mb-1.5 block">
                  {itemCode}
                </span>

                <Link href={`/products/${product.id}`} className="block mb-2 group/title">
                  <h3 className="text-xl font-serif font-medium text-[#171717] tracking-tight group-hover/title:text-[#5D4396] transition-colors leading-snug">
                    {product.name}
                  </h3>
                </Link>

                <p className="text-[#171717]/65 text-xs mb-5 line-clamp-2 leading-relaxed font-sans">
                  {product.short_description || product.description || 'Crafted to bring calm clarity and high-efficiency workflow to your daily routine.'}
                </p>

                {/* Price and Action Footer */}
                <div className="mt-auto pt-3.5 border-t border-[#C8B69A]/30 flex flex-col gap-3.5">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold font-sans text-[#171717] tracking-tight">
                        ₹{product.price}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-[#171717]/40 line-through">
                          ₹{product.original_price}
                        </span>
                      )}
                    </div>
                    {hasDiscount && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-semibold bg-[#EEF4EE] text-[#386138] border border-[#DCE8DC]">
                        Save {discountPct}%
                      </span>
                    )}
                  </div>

                  {/* Buttons Row */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <AddToCartButton
                        product={{
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          image_url: primaryImage,
                        }}
                        variant="outline"
                        className="w-full !rounded-md !py-2 !border-[#C8B69A]/70 hover:!border-[#171717] !text-[#171717] hover:!bg-[#171717] hover:!text-[#F7F4EF] transition-all text-xs uppercase tracking-wider font-medium"
                      />
                    </div>
                    <Link
                      href={`/products/${product.id}`}
                      className="flex-1 bg-[#171717] text-[#F7F4EF] hover:bg-[#2E2822] py-2 px-3 rounded-md text-xs uppercase tracking-wider font-medium transition-all duration-200 flex items-center justify-center gap-1.5 group/btn shadow-2xs hover:shadow cursor-pointer text-center"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform opacity-80" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="bg-[#FAF8F5] rounded-2xl p-14 text-center border border-[#C8B69A]/40 max-w-md mx-auto my-8">
          <div className="w-10 h-10 rounded-xl bg-[#EDE8F5] text-[#5D4396] flex items-center justify-center mx-auto mb-3 font-serif text-lg font-bold">
            ✦
          </div>
          <h3 className="text-lg font-serif font-medium text-[#171717] mb-2">No templates in this category</h3>
          <p className="text-xs text-[#171717]/65 mb-5 font-sans leading-relaxed">
            We are currently crafting new systems for this section. Check out our complete catalog.
          </p>
          <button
            type="button"
            onClick={() => setActiveCategory('All')}
            className="px-5 py-2.5 rounded-md bg-[#171717] text-[#F7F4EF] text-xs uppercase tracking-wider font-medium hover:bg-[#2E2822] transition-colors cursor-pointer"
          >
            View All Templates
          </button>
        </div>
      )}
    </div>
  );
}
