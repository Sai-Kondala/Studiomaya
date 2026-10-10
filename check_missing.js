const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMissing() {
  const { data: orders } = await supabase.from('orders').select('id, created_at, status');
  const { data: items } = await supabase.from('order_items').select('order_id');
  
  const itemSet = new Set(items.map(i => i.order_id));
  const missing = orders.filter(o => !itemSet.has(o.id));
  
  console.log(`Orders missing items: ${missing.length}`);
  if (missing.length > 0) {
    console.log(`First missing order: ${JSON.stringify(missing[0])}`);
    console.log(`Last missing order: ${JSON.stringify(missing[missing.length - 1])}`);
  }
}

checkMissing();
