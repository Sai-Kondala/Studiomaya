const { createClient } = require('@supabase/supabase-js');

async function testGetUser() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  );

  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  );

  // Create a user directly using admin API (bypasses email confirmation)
  const email = `test.admin.${Date.now()}@gmail.com`;
  const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true
  });

  if (createError) {
    console.error('Create user error:', createError);
    return;
  }

  // Sign in to get a JWT
  const { data: { session }, error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password: 'password123'
  });

  if (signInError) {
    console.error('Sign in error:', signInError);
    return;
  }

  const jwt = session.access_token;
  
  // Try to getUser with admin client
  const { data: adminData, error: adminError } = await supabaseAdmin.auth.getUser(jwt);
  console.log('Admin getUser error:', adminError?.message || null);
  console.log('Admin getUser email:', adminData?.user?.email);

}

testGetUser();
