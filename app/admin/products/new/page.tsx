'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createProductAction } from '../actions';

export default function AddProduct() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
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
      const combined = [...selectedImages, ...validFiles];
      setSelectedImages(combined);
      setImagePreviews(combined.map(f => URL.createObjectURL(f)));
      e.target.value = '';
    }
  }

  function removeImage(indexToRemove: number) {
    const updated = selectedImages.filter((_, idx) => idx !== indexToRemove);
    setSelectedImages(updated);
    setImagePreviews(updated.map(f => URL.createObjectURL(f)));
  }

  function setAsCover(indexToMove: number) {
    if (indexToMove === 0) return;
    const target = selectedImages[indexToMove];
    const rest = selectedImages.filter((_, idx) => idx !== indexToMove);
    const reordered = [target, ...rest];
    setSelectedImages(reordered);
    setImagePreviews(reordered.map(f => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedImages.length === 0) {
      alert('Please upload at least one product image.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const pdfFile = formData.get('pdf') as File;
    if (pdfFile && pdfFile.size > 5 * 1024 * 1024) {
      alert(`The selected PDF file (${(pdfFile.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 5 MB limit. Please select a PDF under 5 MB.`);
      return;
    }

    setLoading(true);

    formData.delete('images');
    formData.delete('image');
    selectedImages.forEach(file => {
      formData.append('images', file);
    });

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

            {/* Product Images (Multiple Upload) */}
            <div className="col-span-2 p-6 border-2 border-dashed rounded-xl bg-gray-50">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">
                  Product Images * (PNG, JPG, WEBP - Max 2 MB each)
                </label>
                <span className="text-xs text-gray-500">
                  {selectedImages.length} image{selectedImages.length === 1 ? '' : 's'} selected
                </span>
              </div>

              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {imagePreviews.map((url, idx) => (
                    <div key={idx} className="relative group bg-white p-2 rounded-lg border shadow-xs flex flex-col items-center">
                      <img 
                        src={url} 
                        alt={`Preview ${idx + 1}`} 
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
                              onClick={() => setAsCover(idx)}
                              className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                              title="Set as cover image"
                            >
                              Make Cover
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="text-red-500 hover:text-red-700 font-bold text-xs ml-1 cursor-pointer"
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <input 
                type="file" 
                accept="image/*" 
                multiple 
                onChange={handleImagesChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer" 
              />
              <p className="text-xs text-gray-500 mt-2">
                Select one or multiple images (max 2 MB each). The first image will be used as the primary cover photo.
              </p>
            </div>

            <div className="col-span-2 p-6 border-2 border-dashed rounded-xl bg-gray-50 text-center">
              <label className="block text-sm font-medium mb-2 cursor-pointer">
                Product PDF (Delivery File) * (Max 5 MB)
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