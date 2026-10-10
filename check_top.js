const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTopProducts() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, created_at, amount, status');
    
  if (error) {
    console.error(error);
    return;
  }
  
  const { data: orderItems } = await supabase.from('order_items').select('*');
  const { data: products } = await supabase.from('products').select('*');

  const paidOrders = orders.filter(o => o.status === 'paid');
  console.log(`Total orders: ${orders.length}, Paid orders: ${paidOrders.length}`);
  
  const paidOrderIds = new Set(paidOrders.map(o => o.id));
  
  const paidItems = orderItems.filter(item => paidOrderIds.has(item.order_id));
  console.log(`Total order items: ${orderItems.length}, Paid items: ${paidItems.length}`);
  
  const productCounts = {};
  paidItems.forEach(item => {
    productCounts[item.product_id] = (productCounts[item.product_id] || 0) + 1;
  });
  
  console.log('Product counts for paid orders:');
  for (const [pId, count] of Object.entries(productCounts)) {
    const prod = products.find(p => p.id === pId);
    console.log(`- ${prod ? prod.name : pId}: ${count}`);
  }
}

checkTopProducts();
