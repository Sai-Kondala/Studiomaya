const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
    const { error: itemsError } = await supabase.from('order_items').insert({
      order_id: '123e4567-e89b-12d3-a456-426614174000',
      product_id: 'test',
      unit_price: 100,
      product_name_snapshot: 'test'
    });
    console.log('Insert order_items error:', itemsError);
}

checkSchema();
