const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  const { data: customers } = await supabase.from('customers').select('*');
  const { data: orders } = await supabase.from('orders').select('*');
  console.log('Customers count:', customers?.length);
  console.log('Orders count:', orders?.length);
}

checkData();
