import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createSupabaseAdminClient();
  
  const { data: orders } = await supabase
    .from('orders')
    .select('created_at, amount, status, order_items(product_id)')
    .eq('status', 'paid'); 

  const { data: products } = await supabase
    .from('products')
    .select('id, name');

  let totalSales = 0;
  let topProducts: {name: string, count: number}[] = [];
  const currentYear = new Date().getFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlySales = new Array(12).fill(0);

  if (orders) {
    totalSales = orders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);

    orders.forEach(order => {
      const date = new Date(order.created_at);
      if (date.getFullYear() === currentYear) {
        monthlySales[date.getMonth()] += (Number(order.amount) || 0);
      }
    });

    if (products) {
      const productCounts: Record<string, number> = {};
      orders.forEach(order => {
        if (order.order_items && Array.isArray(order.order_items)) {
          order.order_items.forEach((item: any) => {
            if (item.product_id) {
              productCounts[item.product_id] = (productCounts[item.product_id] || 0) + 1;
            }
          });
        }
      });

      topProducts = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([productId, count]) => {
          const product = products.find(p => p.id === productId);
          return { name: product?.name || 'Unknown Product', count };
        });
    }
  }

  const monthlyData = months.map((month, index) => ({ month, sales: monthlySales[index] }));
  const maxMonthlySale = Math.max(...monthlyData.map(d => d.sales), 1); 

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Total Revenue</h2>
          <p className="text-3xl font-bold text-gray-900">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalSales)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Top 3 Products</h2>
          <ul className="space-y-3">
            {topProducts.length > 0 ? topProducts.map((prod, idx) => (
              <li key={idx} className="flex justify-between items-center text-sm">
                <span className="font-medium text-gray-800">{prod.name}</span>
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">{prod.count} sold</span>
              </li>
            )) : <li className="text-sm text-gray-500">No sales yet.</li>}
          </ul>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h2 className="text-sm font-medium text-gray-500 mb-6">Monthly Sales ({currentYear})</h2>
        <div className="h-64 flex items-end justify-between gap-2">
          {monthlyData.map((data, idx) => {
            const heightPercentage = (data.sales / maxMonthlySale) * 100;
            return (
              <div key={idx} className="flex flex-col items-center flex-1 group">
                <span className="opacity-0 group-hover:opacity-100 text-xs text-gray-600 mb-2 transition-opacity">
                  ₹{data.sales}
                </span>
                <div 
                  className="w-full bg-blue-500 rounded-t-sm hover:bg-blue-600 transition-colors"
                  style={{ height: `${heightPercentage}%`, minHeight: data.sales > 0 ? '4px' : '0' }}
                ></div>
                <span className="text-xs text-gray-400 mt-2">{data.month}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}