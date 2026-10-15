const { createClient } = require('@supabase/supabase-js');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase server credentials.');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAdminUser() {
  const targetEmail = process.argv[2]?.trim().toLowerCase();

  if (!targetEmail || !targetEmail.includes('@')) {
    console.error('Usage: node add_admin.js <admin_email@example.com>');
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('admin_users')
    .insert({ email: targetEmail })
    .select();

  if (error) {
    console.error('Failed to add admin user:', error);
  } else {
    console.log(`Successfully added admin user: ${targetEmail}`);
  }
}

addAdminUser();
