import { supabase } from '../../../lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CheckoutButton from '../../../components/CheckoutButton';

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

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-24">
      {/* Navigation */}
      <nav className="flex justify-between items-center py-6 px-8 max-w-6xl mx-auto border-b border-gray-200 mb-12">
        <Link href="/" className="font-bold text-xl flex items-center gap-2">
          <div className="w-6 h-6 bg-black rounded-md"></div>
          Studio Maya
        </Link>
        <div className="space-x-6 text-sm font-medium text-gray-600 hidden md:block">
          <Link href="/" className="hover:text-black">Products</Link>
          <Link href="#" className="hover:text-black">Categories</Link>
        </div>
        <Link href="/" className="text-sm font-medium text-gray-500 hover:text-black">← Back</Link>
      </nav>

      {/* Product Details Section */}
      <div className="max-w-6xl mx-auto px-8 grid grid-cols-1 md:grid-cols-2 gap-16">
        
        {/* Left Column: Image Gallery */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm aspect-video flex items-center justify-center">
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          </div>
          {/* Thumbnail placeholders to match the design */}
          <div className="flex gap-4">
            <div className="w-24 h-16 bg-white border-2 border-black rounded-lg overflow-hidden cursor-pointer">
              <img src={product.image_url} alt="thumbnail" className="w-full h-full object-cover" />
            </div>
            <div className="w-24 h-16 bg-white border border-gray-200 rounded-lg overflow-hidden opacity-50 cursor-pointer">
              <img src={product.image_url} alt="thumbnail" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* Right Column: Checkout & Details */}
        <div className="flex flex-col justify-center">
          <div className="inline-block bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1 rounded-full w-max mb-4">
            {product.category || 'Notion Template'}
          </div>
          
          <h1 className="text-4xl font-extrabold mb-4">{product.name}</h1>
          
          <div className="flex items-center gap-2 mb-6">
            <span className="text-yellow-400 text-xl">★★★★★</span>
            <span className="text-sm text-gray-500 font-medium">4.9 (120 reviews)</span>
          </div>

          <div className="text-4xl font-bold mb-6">₹{product.price}</div>

          <p className="text-gray-600 mb-8 leading-relaxed">
            {product.short_description || product.description}
          </p>

          <div className="space-y-4 mb-10">
            <div className="flex items-center gap-3 text-sm text-gray-600 font-medium">
              <span className="text-black">✓</span> Instant delivery to your email
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 font-medium">
              <span className="text-black">✓</span> One-time payment, lifetime access
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 font-medium">
              <span className="text-black">✓</span> Beginner friendly setup
            </div>
          </div>

          {/* Using our existing CheckoutButton for now */}
          <div className="w-full h-14">
            <CheckoutButton product={product} rzpKeyId={rzpKeyId} />
          </div>
        </div>
      </div>
    </main>
  );
}