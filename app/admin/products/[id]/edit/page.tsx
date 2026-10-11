'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { updateProductAction } from '../../actions';

interface ProductData {
  id: string;
  name: string;
  short_description: string;
  price: number;
  original_price: number | null;
  category: string;
  status: string;
  image_url?: string;
  pdf_url?: string;
}

export default function EditProduct() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedPdfName, setSelectedPdfName] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;

    async function fetchProduct() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (data) {
        setProduct(data as ProductData);
        if (data.image_url) {
          setImagePreview(data.image_url);
        }
      } else {
        console.error("Error fetching product:", error);
      }
      setFetching(false);
    }
    fetchProduct();
  }, [productId]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPdfName(file.name);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      await updateProductAction(productId, formData);

      alert('Product updated successfully!');
      router.push('/admin/products');
      router.refresh();
    } catch (error: unknown) {
      console.error(error);
      alert('Error updating product: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return <div className="p-8 text-gray-500">Loading product details...</div>;
  if (!product) return <div className="p-8 text-red-500">Product not found.</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/products" className="text-sm text-gray-500 hover:text-black mb-6 inline-block">
        ← Back to Products
      </Link>
      
      <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-6">Edit Product: {product.name}</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Product Title *</label>
              <input type="text" name="title" defaultValue={product.name} required className="w-full border rounded-lg px-4 py-2" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Short Description *</label>
              <textarea name="short_description" defaultValue={product.short_description} required rows={3} className="w-full border rounded-lg px-4 py-2"></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Selling Price (₹) *</label>
              <input type="number" name="price" defaultValue={product.price} required className="w-full border rounded-lg px-4 py-2" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">M.R.P (Optional Strikethrough) (₹)</label>
              <input type="number" name="original_price" defaultValue={product.original_price || ''} className="w-full border rounded-lg px-4 py-2" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Category *</label>
              <select name="category" defaultValue={product.category} className="w-full border rounded-lg px-4 py-2 bg-white">
                <option value="Notion Templates">Notion Templates</option>
                <option value="Productivity">Productivity</option>
                <option value="Study">Study</option>
                <option value="Finance">Finance</option>
              </select>
            </div>

            {/* Product Image / Photo Upload */}
            <div className="col-span-2 p-6 border-2 border-dashed rounded-xl bg-gray-50">
              <label className="block text-sm font-medium mb-2">
                Product Image (PNG, JPG, WEBP)
              </label>
              
              {imagePreview && (
                <div className="mb-4 flex items-center gap-4 bg-white p-3 rounded-lg border">
                  <img 
                    src={imagePreview} 
                    alt="Product preview" 
                    className="w-16 h-16 object-cover rounded-md border shadow-sm" 
                  />
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {imagePreview === product?.image_url ? 'Current Image' : 'New Image Selected'}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose another file below if you want to replace it.
                    </p>
                  </div>
                </div>
              )}

              <input 
                type="file" 
                name="image" 
                accept="image/*" 
                onChange={handleImageChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer" 
              />
              <p className="text-xs text-gray-500 mt-2">
                Leave empty to keep current image, or select a new file to update it.
              </p>
            </div>

            {/* Product Delivery File / PDF Upload */}
            <div className="col-span-2 p-6 border-2 border-dashed rounded-xl bg-gray-50">
              <label className="block text-sm font-medium mb-2">
                Product PDF (Delivery File)
              </label>

              {product?.pdf_url && (
                <div className="mb-4 flex items-center justify-between bg-white p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Current Attached Delivery File</p>
                      <p className="text-xs text-gray-500 font-mono truncate max-w-xs">{product.pdf_url.split('/').pop()}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700">
                    Active
                  </span>
                </div>
              )}

              {selectedPdfName && (
                <div className="mb-3 text-xs bg-blue-50 text-blue-800 p-2.5 rounded-lg border border-blue-200">
                  New file selected for replacement: <strong>{selectedPdfName}</strong>
                </div>
              )}

              <input 
                type="file" 
                name="pdf" 
                accept=".pdf" 
                onChange={handlePdfChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer" 
              />
              <p className="text-xs text-gray-500 mt-2">
                Leave empty to keep current PDF delivery file, or upload a new .pdf to replace it.
              </p>
            </div>

            <div className="col-span-2 flex items-center space-x-6">
              <span className="text-sm font-medium">Status:</span>
              <label className="flex items-center space-x-2">
                <input type="radio" name="status" value="Published" defaultChecked={product.status === 'Published'} className="text-black" />
                <span className="text-sm">Published</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="radio" name="status" value="Draft" defaultChecked={product.status === 'Draft'} className="text-black" />
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}