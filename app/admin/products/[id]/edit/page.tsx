'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { updateProductAction } from '../../actions';
import { getProductImages } from '@/lib/productUtils';

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

  // Multiple image management states
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

  // PDF state
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
        setExistingImages(getProductImages(data.image_url));
      } else {
        console.error("Error fetching product:", error);
      }
      setFetching(false);
    }
    fetchProduct();
  }, [productId]);

  function handleNewImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const oversized = filesArray.filter(f => f.size > 2 * 1024 * 1024);
      if (oversized.length > 0) {
        alert(
          `The following image(s) exceed the 2 MB limit:\n` +
          oversized.map(f => `• ${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB)`).join('\n') +
          `\nPlease compress or select images under 2 MB.`
        );
      }

      const validFiles = filesArray.filter(f => f.size <= 2 * 1024 * 1024);
      const combined = [...newImages, ...validFiles];
      setNewImages(combined);
      setNewImagePreviews(combined.map(f => URL.createObjectURL(f)));
      e.target.value = '';
    }
  }

  function removeExistingImage(indexToRemove: number) {
    setExistingImages(existingImages.filter((_, idx) => idx !== indexToRemove));
  }

  function removeNewImage(indexToRemove: number) {
    const updated = newImages.filter((_, idx) => idx !== indexToRemove);
    setNewImages(updated);
    setNewImagePreviews(updated.map(f => URL.createObjectURL(f)));
  }

  function setExistingAsCover(indexToMove: number) {
    if (indexToMove === 0) return;
    const target = existingImages[indexToMove];
    const rest = existingImages.filter((_, idx) => idx !== indexToMove);
    setExistingImages([target, ...rest]);
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`The selected PDF file (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 5 MB limit. Please select a PDF under 5 MB.`);
        e.target.value = '';
        setSelectedPdfName(null);
        return;
      }
      setSelectedPdfName(file.name);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (existingImages.length === 0 && newImages.length === 0) {
      alert('Please have at least one product image.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const pdfFile = formData.get('pdf') as File;
    if (pdfFile && pdfFile.size > 5 * 1024 * 1024) {
      alert(`The selected PDF file (${(pdfFile.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 5 MB limit. Please select a PDF under 5 MB.`);
      return;
    }

    setLoading(true);
    formData.append('has_image_management', 'true');
    formData.delete('existing_images');
    existingImages.forEach(url => formData.append('existing_images', url));
    formData.delete('images');
    formData.delete('image');
    newImages.forEach(file => formData.append('images', file));

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

            {/* Product Images (Multiple Management & Upload) */}
            <div className="col-span-2 p-6 border-2 border-dashed rounded-xl bg-gray-50">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium">
                  Product Images (PNG, JPG, WEBP - Max 2 MB each)
                </label>
                <span className="text-xs text-gray-500">
                  {existingImages.length + newImages.length} total image{existingImages.length + newImages.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Current Active Images */}
              {existingImages.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Current Images:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {existingImages.map((url, idx) => (
                      <div key={idx} className="relative group bg-white p-2 rounded-lg border shadow-xs flex flex-col items-center">
                        <img 
                          src={url} 
                          alt={`Current image ${idx + 1}`} 
                          className="w-full h-24 object-cover rounded-md border" 
                        />
                        <div className="mt-2 flex items-center justify-between w-full px-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            idx === 0 ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {idx === 0 ? 'Cover' : `#${idx + 1}`}
                          </span>
                          <div className="flex gap-1">
                            {idx !== 0 && (
                              <button
                                type="button"
                                onClick={() => setExistingAsCover(idx)}
                                className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                                title="Set as primary cover"
                              >
                                Make Cover
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeExistingImage(idx)}
                              className="text-red-500 hover:text-red-700 font-bold text-xs ml-1 cursor-pointer"
                              title="Delete this image"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Newly Selected Previews */}
              {newImagePreviews.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-blue-600 mb-2">New Images to be Added:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {newImagePreviews.map((url, idx) => (
                      <div key={idx} className="relative group bg-blue-50/50 p-2 rounded-lg border border-blue-200 shadow-xs flex flex-col items-center">
                        <img 
                          src={url} 
                          alt={`New preview ${idx + 1}`} 
                          className="w-full h-24 object-cover rounded-md border" 
                        />
                        <div className="mt-2 flex items-center justify-between w-full px-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            + New #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeNewImage(idx)}
                            className="text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer"
                            title="Cancel adding this image"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <input 
                type="file" 
                accept="image/*" 
                multiple 
                onChange={handleNewImagesChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer" 
              />
              <p className="text-xs text-gray-500 mt-2">
                Upload one or multiple new images. Click ✕ to remove any existing or newly chosen image.
              </p>
            </div>

            {/* Product Delivery File / PDF Upload */}
            <div className="col-span-2 p-6 border-2 border-dashed rounded-xl bg-gray-50">
              <label className="block text-sm font-medium mb-2">
                Product PDF (Delivery File) (Max 5 MB)
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