'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createProductAction } from '../actions';

export default function AddProduct() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      await createProductAction(formData);

      alert('Product saved successfully!');
      router.push('/admin/products');
      router.refresh();

    } catch (error: unknown) {
      console.error(error);
      alert('Error uploading product: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/products" className="text-sm text-gray-500 hover:text-black mb-6 inline-block">
        ← Back to Products
      </Link>
      
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-6">Add New Product</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Product Title *</label>
              <input type="text" name="title" required className="w-full border rounded-lg px-4 py-2" placeholder="e.g. Student Life OS" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Short Description *</label>
              <textarea name="short_description" required rows={3} className="w-full border rounded-lg px-4 py-2" placeholder="A short description for the product card..."></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Selling Price (₹) *</label>
              <input type="number" name="price" required className="w-full border rounded-lg px-4 py-2" placeholder="499" />
            </div>

            {/* New Optional M.R.P. Field */}
            <div>
              <label className="block text-sm font-medium mb-2">M.R.P (Optional Strikethrough) (₹)</label>
              <input type="number" name="original_price" className="w-full border rounded-lg px-4 py-2" placeholder="899" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Category *</label>
              <select name="category" className="w-full border rounded-lg px-4 py-2 bg-white">
                <option>Notion Templates</option>
                <option>Productivity</option>
                <option>Study</option>
                <option>Finance</option>
              </select>
            </div>

            <div className="col-span-2 p-6 border-2 border-dashed rounded-xl bg-gray-50 text-center">
              <label className="block text-sm font-medium mb-2 cursor-pointer">
                Product Image * (PNG, JPG)
                <input type="file" name="image" accept="image/*" required className="block w-full mt-2 mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800" />
              </label>
            </div>

            <div className="col-span-2 p-6 border-2 border-dashed rounded-xl bg-gray-50 text-center">
              <label className="block text-sm font-medium mb-2 cursor-pointer">
                Product PDF (Delivery File) *
                <input type="file" name="pdf" accept=".pdf" required className="block w-full mt-2 mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800" />
              </label>
            </div>

            <div className="col-span-2 flex items-center space-x-6">
              <span className="text-sm font-medium">Status:</span>
              <label className="flex items-center space-x-2">
                <input type="radio" name="status" value="Published" defaultChecked className="text-black" />
                <span className="text-sm">Published</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="radio" name="status" value="Draft" className="text-black" />
                <span className="text-sm">Draft</span>
              </label>
            </div>
          </div>

          <div className="pt-6 border-t flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-black text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}