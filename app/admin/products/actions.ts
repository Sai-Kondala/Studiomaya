'use server';

import { verifyAdminSession } from '@/lib/adminAuth';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

interface ValidatedFile {
  buffer: Buffer;
  extension: string;
  mimeType: string;
}

/**
 * Validates image MIME type and file signature (magic bytes) to prevent
 * arbitrary file upload / extension spoofing attacks.
 */
async function validateImageFile(file: File): Promise<ValidatedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (file.type && !allowedMimes.includes(file.type)) {
    throw new Error(`Unsupported image MIME type "${file.type}" for "${file.name}".`);
  }

  // 1. JPEG: 0xFF, 0xD8, 0xFF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { buffer, extension: 'jpg', mimeType: 'image/jpeg' };
  }

  // 2. PNG: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { buffer, extension: 'png', mimeType: 'image/png' };
  }

  // 3. WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('utf8', 0, 4) === 'RIFF' &&
    buffer.toString('utf8', 8, 12) === 'WEBP'
  ) {
    return { buffer, extension: 'webp', mimeType: 'image/webp' };
  }

  // 4. GIF: GIF87a or GIF89a
  if (
    buffer.length >= 6 &&
    (buffer.toString('utf8', 0, 6) === 'GIF87a' || buffer.toString('utf8', 0, 6) === 'GIF89a')
  ) {
    return { buffer, extension: 'gif', mimeType: 'image/gif' };
  }

  throw new Error(`File signature does not match a valid image format for "${file.name}".`);
}

/**
 * Validates PDF MIME type and magic bytes (%PDF-).
 */
async function validatePdfFile(file: File): Promise<ValidatedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type && file.type !== 'application/pdf') {
    throw new Error(`Invalid PDF MIME type "${file.type}" for "${file.name}".`);
  }

  if (buffer.length < 5 || buffer.toString('utf8', 0, 5) !== '%PDF-') {
    throw new Error(`File signature does not match a valid PDF document for "${file.name}".`);
  }

  return { buffer, extension: 'pdf', mimeType: 'application/pdf' };
}

export async function createProductAction(formData: FormData) {
  const { supabaseAdmin } = await verifyAdminSession();

  const imageFiles = formData.getAll('images') as File[];
  const singleImage = formData.get('image') as File | null;
  const rawFiles = [...imageFiles, ...(singleImage ? [singleImage] : [])];
  const validImageFiles = rawFiles.filter(f => f && typeof f.size === 'number' && f.size > 0 && f.name);

  const pdfFile = formData.get('pdf') as File;
  const originalPrice = formData.get('original_price');

  for (const file of validImageFiles) {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error(`Image "${file.name}" exceeds the 2 MB limit.`);
    }
  }

  if (pdfFile && pdfFile.size > 5 * 1024 * 1024) {
    throw new Error('PDF delivery file exceeds the 5 MB limit.');
  }

  const uploadedImageUrls: string[] = [];

  for (let i = 0; i < validImageFiles.length; i++) {
    const file = validImageFiles[i];
    const { buffer, extension, mimeType } = await validateImageFile(file);
    const safeImageName = `${Date.now()}_${i}_${crypto.randomUUID()}.${extension}`;

    const { error: imgError } = await supabaseAdmin.storage
      .from('product-images')
      .upload(safeImageName, buffer, { contentType: mimeType, upsert: false });

    if (imgError) throw new Error(imgError.message);

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(safeImageName);

    uploadedImageUrls.push(publicUrlData.publicUrl);
  }

  const imageUrl = uploadedImageUrls.join(',');
  let pdfPath = '';

  if (pdfFile && pdfFile.size > 0) {
    const { buffer, extension, mimeType } = await validatePdfFile(pdfFile);
    const safePdfName = `${Date.now()}_${crypto.randomUUID()}.${extension}`;

    const { data: pdfData, error: pdfError } = await supabaseAdmin.storage
      .from('product-files')
      .upload(safePdfName, buffer, { contentType: mimeType, upsert: false });

    if (pdfError) throw new Error(pdfError.message);
    pdfPath = pdfData?.path || '';
  }

  const { error: dbError } = await supabaseAdmin.from('products').insert({
    name: formData.get('title'),
    short_description: formData.get('short_description'),
    category: formData.get('category'),
    price: formData.get('price'),
    original_price: originalPrice ? Number(originalPrice) : null,
    status: formData.get('status'),
    image_url: imageUrl,
    pdf_url: pdfPath,
    description: '',
    template_url: ''
  });

  if (dbError) throw new Error(dbError.message);

  revalidatePath('/admin/products');
  revalidatePath('/');

  return { success: true };
}

export async function updateProductAction(id: string, formData: FormData) {
  const { supabaseAdmin } = await verifyAdminSession();

  const existingImages = (formData.getAll('existing_images') as string[]).filter(Boolean);
  const imageFiles = formData.getAll('images') as File[];
  const singleImage = formData.get('image') as File | null;
  const rawFiles = [...imageFiles, ...(singleImage ? [singleImage] : [])];
  const validImageFiles = rawFiles.filter(f => f && typeof f.size === 'number' && f.size > 0 && f.name);

  const pdfFile = formData.get('pdf') as File;
  const originalPrice = formData.get('original_price');

  for (const file of validImageFiles) {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error(`Image "${file.name}" exceeds the 2 MB limit.`);
    }
  }

  if (pdfFile && pdfFile.size > 5 * 1024 * 1024) {
    throw new Error('PDF delivery file exceeds the 5 MB limit.');
  }

  const updates: any = {
    name: formData.get('title'),
    short_description: formData.get('short_description'),
    category: formData.get('category'),
    price: formData.get('price'),
    original_price: originalPrice ? Number(originalPrice) : null,
    status: formData.get('status')
  };

  const newUploadedUrls: string[] = [];
  for (let i = 0; i < validImageFiles.length; i++) {
    const file = validImageFiles[i];
    const { buffer, extension, mimeType } = await validateImageFile(file);
    const safeImageName = `${Date.now()}_${i}_${crypto.randomUUID()}.${extension}`;

    const { error: imgError } = await supabaseAdmin.storage
      .from('product-images')
      .upload(safeImageName, buffer, { contentType: mimeType, upsert: false });

    if (imgError) throw new Error(imgError.message);

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(safeImageName);

    newUploadedUrls.push(publicUrlData.publicUrl);
  }

  if (formData.has('has_image_management') || existingImages.length > 0 || newUploadedUrls.length > 0) {
    const finalImages = [...existingImages, ...newUploadedUrls];
    updates.image_url = finalImages.join(',');
  }

  if (pdfFile && pdfFile.size > 0) {
    const { buffer, extension, mimeType } = await validatePdfFile(pdfFile);
    const safePdfName = `${Date.now()}_${crypto.randomUUID()}.${extension}`;

    const { data: pdfData, error: pdfError } = await supabaseAdmin.storage
      .from('product-files')
      .upload(safePdfName, buffer, { contentType: mimeType, upsert: false });

    if (pdfError) throw new Error(pdfError.message);
    updates.pdf_url = pdfData?.path;
  }

  const { error: dbError } = await supabaseAdmin.from('products').update(updates).eq('id', id);

  if (dbError) throw new Error(dbError.message);

  revalidatePath('/admin/products');
  revalidatePath('/');
  revalidatePath(`/products/${id}`);

  return { success: true };
}
