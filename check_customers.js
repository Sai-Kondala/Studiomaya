const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCustomers() {
  const { data, error } = await supabase.from('customers').select('*');
  if (error) {
    console.error('Customers Error:', error);
  } else {
    console.log('Customers count:', data.length);
  }
}

checkCustomers();
