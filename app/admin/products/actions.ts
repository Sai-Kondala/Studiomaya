'use server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

async function checkAdmin() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('sb-auth-token');
  
  if (!authCookie || !authCookie.value) {
    throw new Error('Unauthorized');
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authCookie.value);

  if (authError || !user || !user.email) {
    throw new Error('Unauthorized');
  }

  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from('admin_users')
    .select('email')
    .eq('email', user.email)
    .single();

  if (dbError || !adminUser) {
    throw new Error('Unauthorized');
  }

  return supabaseAdmin;
}

export async function createProductAction(formData: FormData) {
  const supabaseAdmin = await checkAdmin();

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
    const imageExt = file.name.split('.').pop() || 'png';
    const imageName = `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}.${imageExt}`;
    const { error: imgError } = await supabaseAdmin.storage
      .from('product-images')
      .upload(imageName, file);

    if (imgError) throw new Error(imgError.message);

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(imageName);

    uploadedImageUrls.push(publicUrlData.publicUrl);
  }

  const imageUrl = uploadedImageUrls.join(',');
  let pdfPath = '';

  if (pdfFile && pdfFile.size > 0) {
    const pdfExt = pdfFile.name.split('.').pop();
    const pdfName = `${Date.now()}.${pdfExt}`;
    const { data: pdfData, error: pdfError } = await supabaseAdmin.storage
      .from('product-files')
      .upload(pdfName, pdfFile);

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
  const supabaseAdmin = await checkAdmin();

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
    const imageExt = file.name.split('.').pop() || 'png';
    const imageName = `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}.${imageExt}`;
    const { error: imgError } = await supabaseAdmin.storage
      .from('product-images')
      .upload(imageName, file);

    if (imgError) throw new Error(imgError.message);

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(imageName);

    newUploadedUrls.push(publicUrlData.publicUrl);
  }

  if (formData.has('has_image_management') || existingImages.length > 0 || newUploadedUrls.length > 0) {
    const finalImages = [...existingImages, ...newUploadedUrls];
    updates.image_url = finalImages.join(',');
  }

  if (pdfFile && pdfFile.size > 0) {
    const pdfExt = pdfFile.name.split('.').pop();
    const pdfName = `${Date.now()}.${pdfExt}`;
    const { data: pdfData, error: pdfError } = await supabaseAdmin.storage
      .from('product-files')
      .upload(pdfName, pdfFile);

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
