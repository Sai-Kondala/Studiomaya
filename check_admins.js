const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdminUsers() {
  const { data, error } = await supabase.from('admin_users').select('*');
  if (error) {
    console.error('Error fetching admin_users:', error);
  } else {
    console.log('Admin users:', data);
  }
}

checkAdminUsers();
