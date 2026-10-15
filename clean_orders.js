const { createClient } = require('@supabase/supabase-js');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase server credentials.');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanOldTestOrders() {
  // Restrict cleanup strictly to stale pending orders older than 24 hours
  const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: stalePendingOrders, error: fetchErr } = await supabase
    .from('orders')
    .select('id, order_items(id)')
    .eq('status', 'pending')
    .lt('created_at', cutoffIso);

  if (fetchErr) {
    console.error('Error fetching stale pending orders:', fetchErr);
    process.exit(1);
  }

  const emptyOrderIds = (stalePendingOrders || [])
    .filter((o) => !Array.isArray(o.order_items) || o.order_items.length === 0)
    .map((o) => o.id);

  if (emptyOrderIds.length > 0) {
    const { error: delErr } = await supabase
      .from('orders')
      .delete()
      .in('id', emptyOrderIds)
      .eq('status', 'pending');

    if (delErr) {
      console.error('Failed to delete stale empty orders:', delErr);
    } else {
      console.log(`Safely deleted ${emptyOrderIds.length} stale pending orders with no attached items.`);
    }
  } else {
    console.log('No stale empty pending orders found.');
  }
}

cleanOldTestOrders();
