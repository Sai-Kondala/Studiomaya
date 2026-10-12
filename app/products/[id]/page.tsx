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

  if (error || !product) {
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
    <main className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-24">
      {/* Global Brand Navigation with Cart Drawer trigger and customer avatar */}
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-4">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-black transition-colors"
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
        <div className="flex flex-col justify-center bg-white p-8 sm:p-10 rounded-3xl border border-gray-100 shadow-xs">
          <div className="inline-block bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full w-max mb-4">
            {product.category || 'Notion Template'}
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 text-gray-950 tracking-tight">
            {product.name}
          </h1>
          
          <div className="flex items-center gap-2 mb-6">
            <span className="text-amber-400 text-base">★★★★★</span>
            <span className="text-xs text-gray-500 font-medium">4.9 • 120+ Verified Purchases</span>
          </div>

          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-4xl font-black text-gray-950">₹{product.price}</span>
            {product.original_price && (
              <span className="text-lg text-gray-400 line-through">₹{product.original_price}</span>
            )}
          </div>

          <p className="text-gray-600 mb-8 leading-relaxed text-sm sm:text-base">
            {product.short_description || product.description}
          </p>

          <div className="space-y-3.5 mb-8 p-4 rounded-2xl bg-gray-50 border border-gray-100/80">
            <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-700 font-medium">
              <Zap className="w-4 h-4 text-black shrink-0" />
              <span>Instant automated delivery to your email</span>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-700 font-medium">
              <ShieldCheck className="w-4 h-4 text-black shrink-0" />
              <span>One-time purchase, lifetime updates & access</span>
            </div>
            <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-700 font-medium">
              <RefreshCw className="w-4 h-4 text-black shrink-0" />
              <span>Duplicate directly into your workspace in 1-click</span>
            </div>
          </div>

          {/* Action Buttons: Add to Cart + Buy Now */}
          <div className="flex flex-col sm:flex-row gap-3.5 w-full">
            <div className="flex-1 h-14">
              <AddToCartButton 
                product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  image_url: primaryImage
                }}
                variant="outline"
                showIcon={true}
                className="w-full h-full text-base font-semibold border-2 border-black rounded-2xl flex items-center justify-center gap-2 hover:bg-black hover:text-white transition-all shadow-xs"
              />
            </div>
            <div className="flex-1 h-14">
              <CheckoutButton product={{ ...product, image_url: primaryImage }} rzpKeyId={rzpKeyId} />
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            🔒 256-bit encrypted checkout powered by Razorpay
          </p>
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts && relatedProducts.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-8 mt-20 pt-16 border-t border-gray-200/80">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full mb-2">
                <span>Curated Workspace Systems</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight">
                Related Products
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                More templates and productivity systems to elevate your workflow
              </p>
            </div>
            <Link
              href="/"
              className="text-xs sm:text-sm font-semibold text-gray-600 hover:text-black transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <span>Explore all templates</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {relatedProducts.map((relProduct) => {
              const relPrimaryImage = getProductPrimaryImage(relProduct.image_url);
              return (
                <div
                  key={relProduct.id}
                  className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-md group"
                >
                  <Link href={`/products/${relProduct.id}`} className="block relative aspect-16/10 overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={relPrimaryImage || 'https://via.placeholder.com/400x300'}
                      alt={relProduct.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {relProduct.category && (
                      <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-gray-900 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                        {relProduct.category}
                      </span>
                    )}
                  </Link>

                  <div className="p-5 flex flex-col flex-1">
                    <Link href={`/products/${relProduct.id}`}>
                      <h3 className="text-base sm:text-lg font-bold text-gray-950 mb-1 line-clamp-1 hover:text-gray-700 transition-colors">
                        {relProduct.name}
                      </h3>
                    </Link>
                    
                    <div className="flex items-center gap-1 mb-2.5 text-xs text-gray-500">
                      <span className="text-amber-400">★</span>
                      <span className="font-semibold text-gray-700">4.9</span>
                      <span>• Notion Template</span>
                    </div>

                    <p className="text-gray-500 text-xs sm:text-sm mb-5 line-clamp-2 leading-relaxed">
                      {relProduct.short_description || relProduct.description}
                    </p>

                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-lg sm:text-xl font-extrabold text-gray-950 font-sans">
                          ₹{relProduct.price}
                        </span>
                        {relProduct.original_price && (
                          <span className="text-xs text-gray-400 line-through">
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
                          className="h-9 px-3 rounded-xl border-gray-300 hover:border-black"
                        />
                        <Link
                          href={`/products/${relProduct.id}`}
                          className="bg-black text-white px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-gray-800 transition-colors whitespace-nowrap"
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