import { supabase } from '../../../lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CheckoutButton from '../../../components/CheckoutButton';
import ProductGallery from '../../../components/ProductGallery';
import { Navbar } from '@/components/Navbar';
import { AddToCartButton } from '@/components/AddToCartButton';
import { getProductImages, getProductPrimaryImage } from '@/lib/productUtils';
import { ArrowLeft, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // 1. Await the params first (Required in newer Next.js versions)
  const { id } = await params;

  // 2. Fetch the specific product using the awaited ID
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !product || product.status !== 'Published') {
    notFound();
  }

  const rzpKeyId = process.env.RAZORPAY_KEY_ID!;
  const images = getProductImages(product.image_url);
  const primaryImage = getProductPrimaryImage(product.image_url);

  // 3. Fetch related products (prefer same category, fallback to other published products)
  const { data: allPublished } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'Published')
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(8);

  const relatedProducts = (allPublished || [])
    .sort((a, b) => {
      const aSame = product.category && a.category === product.category ? 1 : 0;
      const bSame = product.category && b.category === product.category ? 1 : 0;
      return bSame - aSame;
    })
    .slice(0, 3);

  return (
    <main className="min-h-screen bg-[#F7F4EF] text-[#171717] font-sans pb-24">
      {/* Global Brand Navigation with Cart Drawer trigger and customer avatar */}
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-4">
        <Link 
          href="/#catalog" 
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#171717]/60 hover:text-[#171717] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Store Catalogue</span>
        </Link>
      </div>

      {/* Product Details Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16 items-start mt-4">
        
        {/* Left Column: Image Gallery */}
        <ProductGallery images={images} productName={product.name} />

        {/* Right Column: Checkout & Details */}
        <div className="flex flex-col justify-center bg-[#FAF8F5] p-8 sm:p-10 rounded-2xl border border-[#C8B69A]/40 shadow-xs">
          <div className="inline-block bg-[#FAF8F5] text-[#7A6953] border border-[#C8B69A]/50 text-[10px] font-mono uppercase tracking-widest font-semibold px-3 py-1 rounded-md w-max mb-4">
            {product.category || 'Notion Template'}
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-serif font-medium mb-3 text-[#171717] tracking-tight leading-tight">
            {product.name}
          </h1>
          
          <div className="flex items-center gap-2 mb-6">
            <span className="text-amber-500 text-base">★★★★★</span>
            <span className="text-xs text-[#171717]/60 font-medium">4.9 • 120+ Verified Purchases</span>
          </div>

          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-4xl font-bold font-sans text-[#171717]">₹{product.price}</span>
            {product.original_price && (
              <span className="text-lg text-[#171717]/40 line-through">₹{product.original_price}</span>
            )}
          </div>

          <p className="text-[#171717]/70 mb-8 leading-relaxed text-sm sm:text-base font-sans">
            {product.short_description || product.description}
          </p>

          <div className="space-y-3.5 mb-8 p-4 rounded-xl bg-[#F7F4EF] border border-[#C8B69A]/30">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-[#171717] font-medium">
              <Zap className="w-4 h-4 text-[#5D4396] shrink-0" />
              <span>Instant automated delivery to your email</span>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-[#171717] font-medium">
              <ShieldCheck className="w-4 h-4 text-[#8C5229] shrink-0" />
              <span>One-time purchase, lifetime updates &amp; access</span>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-[#171717] font-medium">
              <RefreshCw className="w-4 h-4 text-[#386138] shrink-0" />
              <span>Duplicate directly into your workspace in 1-click</span>
            </div>
          </div>

          {/* Action Buttons: Add to Cart + Buy Now */}
          <div className="flex flex-col sm:flex-row gap-3.5 w-full">
            <div className="flex-1 h-12">
              <AddToCartButton 
                product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  image_url: primaryImage
                }}
                variant="outline"
                showIcon={true}
                className="w-full h-full text-xs uppercase tracking-wider font-semibold border border-[#C8B69A]/70 hover:border-[#171717] rounded-md flex items-center justify-center gap-2 hover:bg-[#171717] hover:text-[#F7F4EF] transition-all shadow-2xs"
              />
            </div>
            <div className="flex-1 h-12">
              <CheckoutButton product={{ ...product, image_url: primaryImage }} rzpKeyId={rzpKeyId} />
            </div>
          </div>

          <p className="text-center text-xs text-[#171717]/50 mt-4 font-mono">
            🔒 256-bit encrypted checkout powered by Razorpay
          </p>
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts && relatedProducts.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-8 mt-20 pt-16 border-t border-[#C8B69A]/30">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest text-[#7A6953] bg-[#FAF8F5] border border-[#C8B69A]/40 px-2.5 py-1 rounded-md mb-2">
                <span>Curated Workspace Systems</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-medium text-[#171717] tracking-tight">
                Related Products
              </h2>
              <p className="text-[#171717]/60 text-sm mt-1">
                More templates and productivity systems to elevate your workflow
              </p>
            </div>
            <Link
              href="/#catalog"
              className="text-xs font-mono uppercase tracking-wider text-[#171717]/70 hover:text-[#171717] transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <span>Explore all templates</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7">
            {relatedProducts.map((relProduct, idx) => {
              const relPrimaryImage = getProductPrimaryImage(relProduct.image_url);
              return (
                <div
                  key={relProduct.id}
                  className="bg-[#FAF8F5] rounded-2xl border border-[#C8B69A]/35 hover:border-[#C8B69A]/80 p-4 flex flex-col transition-all duration-200 hover:-translate-y-1 shadow-2xs group"
                >
                  <Link href={`/products/${relProduct.id}`} className="block relative aspect-16/10 overflow-hidden bg-[#EFECE6] rounded-xl mb-3 border border-[#C8B69A]/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={relPrimaryImage || '/hero_3d.jpg'}
                      alt={relProduct.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {relProduct.category && (
                      <span className="absolute top-2.5 left-2.5 bg-[#FAF8F5]/95 backdrop-blur-xs text-[#7A6953] border border-[#C8B69A]/40 text-[10px] font-mono uppercase tracking-widest font-semibold px-2 py-0.5 rounded-md shadow-2xs">
                        {relProduct.category}
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-col flex-1 px-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#7A6953] mb-1">
                      NOTION SYSTEM — 0{idx + 1}
                    </span>
                    <Link href={`/products/${relProduct.id}`}>
                      <h3 className="text-base sm:text-lg font-serif font-medium text-[#171717] mb-1 line-clamp-1 hover:text-[#5D4396] transition-colors">
                        {relProduct.name}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center gap-1 mb-2 text-xs text-[#171717]/60">
                      <span className="text-amber-500">★</span>
                      <span className="font-semibold text-[#171717]">4.9</span>
                      <span>• Notion Template</span>
                    </div>

                    <p className="text-[#171717]/65 text-xs mb-4 line-clamp-2 leading-relaxed">
                      {relProduct.short_description || relProduct.description}
                    </p>

                    <div className="mt-auto pt-3 border-t border-[#C8B69A]/20 flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-base sm:text-lg font-bold text-[#171717] font-sans">
                          ₹{relProduct.price}
                        </span>
                        {relProduct.original_price && (
                          <span className="text-xs text-[#171717]/40 line-through">
                            ₹{relProduct.original_price}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <AddToCartButton
                          product={{
                            id: relProduct.id,
                            name: relProduct.name,
                            price: relProduct.price,
                            image_url: relPrimaryImage,
                          }}
                          variant="outline"
                          className="h-8 px-2.5 rounded-md text-[11px] uppercase tracking-wider font-semibold border-[#C8B69A]/70 hover:border-[#171717]"
                        />
                        <Link
                          href={`/products/${relProduct.id}`}
                          className="bg-[#171717] text-[#F7F4EF] px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider font-semibold hover:bg-[#2E2822] transition-colors whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}