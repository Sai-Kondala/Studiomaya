import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default async function AdminProducts() {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link 
          href="/admin/products/new" 
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          + Add Product
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
            <tr>
              <th className="px-6 py-4 font-medium">Image</th>
              <th className="px-6 py-4 font-medium">Title</th>
              <th className="px-6 py-4 font-medium">Price</th>
              <th className="px-6 py-4 font-medium">Category</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products?.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <img src={product.image_url || 'https://via.placeholder.com/40'} alt={product.name} className="w-10 h-10 rounded object-cover border" />
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                
                {/* Updated Price Column with optional M.R.P. */}
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">₹{product.price}</div>
                  {product.original_price && (
                    <div className="text-xs text-gray-500 line-through">M.R.P: ₹{product.original_price}</div>
                  )}
                </td>

                <td className="px-6 py-4 text-gray-500">{product.category || '—'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.status === 'Published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {product.status || 'Draft'}
                  </span>
                </td>

                {/* Fixed Edit Button Link */}
                <td className="px-6 py-4 font-medium">
                  <Link href={`/admin/products/${product.id}/edit`} className="text-blue-600 hover:text-blue-800 transition-colors">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(!products || products.length === 0) && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}