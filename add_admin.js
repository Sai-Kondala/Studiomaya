const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAdminUser() {
  await supabase.from('admin_users').insert({ email: 'saikondala2004@gmail.com' }).select();
  await supabase.from('admin_users').insert({ email: 'saiganeshec25@gmail.com' }).select();
  
  console.log('Added correct emails!');
}

addAdminUser();
