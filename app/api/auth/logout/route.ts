import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL('/login', requestUrl.origin), {
      status: 303,
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Failed to log out' }, { status: 500 });
  }
}
