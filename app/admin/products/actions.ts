'use server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';

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

  const imageFile = formData.get('image') as File;
  const pdfFile = formData.get('pdf') as File;
  const originalPrice = formData.get('original_price');

  let imageUrl = '';
  let pdfPath = '';

  if (imageFile && imageFile.size > 0) {
    const imageExt = imageFile.name.split('.').pop();
    const imageName = `${Date.now()}.${imageExt}`;
    const { error: imgError } = await supabaseAdmin.storage
      .from('product-images')
      .upload(imageName, imageFile);

    if (imgError) throw new Error(imgError.message);

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(imageName);
    
    imageUrl = publicUrlData.publicUrl;
  }

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

  return { success: true };
}

export async function updateProductAction(id: string, formData: FormData) {
  const supabaseAdmin = await checkAdmin();

  const imageFile = formData.get('image') as File;
  const pdfFile = formData.get('pdf') as File;
  const originalPrice = formData.get('original_price');

  const updates: any = {
    name: formData.get('title'),
    short_description: formData.get('short_description'),
    category: formData.get('category'),
    price: formData.get('price'),
    original_price: originalPrice ? Number(originalPrice) : null,
    status: formData.get('status')
  };

  if (imageFile && imageFile.size > 0) {
    const imageExt = imageFile.name.split('.').pop();
    const imageName = `${Date.now()}.${imageExt}`;
    const { error: imgError } = await supabaseAdmin.storage
      .from('product-images')
      .upload(imageName, imageFile);

    if (imgError) throw new Error(imgError.message);

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(imageName);
    
    updates.image_url = publicUrlData.publicUrl;
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

  return { success: true };
}
