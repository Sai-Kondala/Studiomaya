const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanOldTestOrders() {
  const { data: orders } = await supabase.from('orders').select('id');
  const { data: items } = await supabase.from('order_items').select('order_id');
  
  const itemSet = new Set(items.map(i => i.order_id));
  const missing = orders.filter(o => !itemSet.has(o.id));
  
  const missingIds = missing.map(o => o.id);
  
  if (missingIds.length > 0) {
    const { error } = await supabase.from('orders').delete().in('id', missingIds);
    if (error) {
      console.error('Failed to delete old orders:', error);
    } else {
      console.log(`Deleted ${missingIds.length} old corrupt test orders that had no products attached!`);
    }
  } else {
    console.log('No corrupt orders found.');
  }
}

cleanOldTestOrders();
