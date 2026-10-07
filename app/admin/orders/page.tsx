import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import Link from 'next/link';

export default async function AdminOrders() {
  const supabase = createSupabaseAdminClient();
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customer_name, customer_email, "Customer_Phone", status, amount, created_at, razorpay_order_id, product_id, products(name)')
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Orders</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
            <tr>
              <th className="px-6 py-4 font-medium">Order ID</th>
              <th className="px-6 py-4 font-medium">Customer Name</th>
              <th className="px-6 py-4 font-medium">Email</th>
              <th className="px-6 py-4 font-medium">Phone Number</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Amount</th>
              <th className="px-6 py-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders?.map((order) => {
              // Extract a short ID for display
              const shortId = order.id ? order.id.split('-')[0].toUpperCase() : 'N/A';
              const date = new Date(order.created_at).toLocaleDateString('en-IN', {
                year: 'numeric', month: 'short', day: 'numeric'
              });

              return (
                <tr key={order.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 font-medium text-gray-900">ORD-{shortId}</td>
                  <td className="px-6 py-4 text-gray-900">{order.customer_name || '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{order.customer_email || '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{order.Customer_Phone || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {order.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">₹{order.amount || 0}</td>
                  <td className="px-6 py-4 text-gray-500">{date}</td>
                </tr>
              );
            })}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
