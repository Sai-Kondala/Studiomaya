import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { AddToCartButton } from '@/components/AddToCartButton';

export default async function Home() {
  // Fetch only products marked as 'Published'
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'Published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      
      {/* Navigation Bar */}
      <Navbar />

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-8 py-16 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1">
          <h1 className="text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            Notion Templates <br /> for a More Organized Life
          </h1>
          <p className="text-gray-500 text-lg mb-8">
            Productivity systems, planners and tools to help you study, work and live better.
          </p>
          <button className="bg-black text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors">
            Browse Templates →
          </button>
        </div>
        <div className="flex-1 hidden md:block">
          <img 
            src="/hero_image.jpg" 
            alt="Notion Workspace" 
            className="w-full h-auto rounded-2xl shadow-2xl border-4 border-white object-cover"
          />
        </div>
      </div>

      {/* Products Section */}
      <div className="max-w-6xl mx-auto px-8 pb-24">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-6 mb-8 border-b pb-4 text-sm font-medium">
          <button className="border-b-2 border-black pb-4 -mb-[18px] text-black">All</button>
          <button className="text-gray-500 hover:text-black pb-4">Notion</button>
          <button className="text-gray-500 hover:text-black pb-4">Study</button>
          <button className="text-gray-500 hover:text-black pb-4">Productivity</button>
          <button className="text-gray-500 hover:text-black pb-4">Finance</button>
        </div>

        {/* Dynamic Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {products?.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-transform hover:-translate-y-1">
              
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={product.image_url} 
                alt={product.name}
                className="w-full h-52 object-cover border-b border-gray-100"
              />
              
              <div className="p-6 flex flex-col flex-1">
                <h2 className="text-xl font-bold mb-1">{product.name}</h2>
                <div className="flex items-center gap-1 mb-3 text-sm text-gray-500">
                  <span className="text-yellow-400">★</span> 5.0 (New)
                </div>
                <p className="text-gray-500 text-sm mb-6 line-clamp-2">
                  {product.short_description || product.description}
                </p>
                
                <div className="mt-auto flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold">₹{product.price}</span>
                    {product.original_price && (
                      <span className="text-sm text-gray-400 line-through">₹{product.original_price}</span>
                    )}
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-none">
                      <AddToCartButton 
                        product={{
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          image_url: product.image_url
                        }}
                        variant="outline"
                        className="w-full flex justify-center"
                      />
                    </div>
                    <Link 
                      href={`/products/${product.id}`}
                      className="flex-1 sm:flex-none bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap text-center flex items-center justify-center"
                    >
                      View Product →
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          ))}
          {(!products || products.length === 0) && (
            <div className="col-span-3 text-center py-12 text-gray-500">
              No products published yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}