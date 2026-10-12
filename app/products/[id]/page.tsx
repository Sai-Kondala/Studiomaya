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
    </main>
  );
}