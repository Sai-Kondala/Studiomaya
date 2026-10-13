import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { AdminResendReceiptButton } from '@/components/AdminResendReceiptButton';

export const dynamic = 'force-dynamic';

export default async function AdminOrders() {
  const supabase = createSupabaseAdminClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, customer_name, customer_email, customer_phone, status, amount, created_at, razorpay_order_id, email_delivery_status')
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
              <th className="px-6 py-4 font-medium">Email Delivery</th>
              <th className="px-6 py-4 font-medium">Amount</th>
              <th className="px-6 py-4 font-medium">Date</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders?.map((order) => {
              // Extract a short ID for display
              const shortId = order.id ? order.id.split('-')[0].toUpperCase() : 'N/A';
              const date = new Date(order.created_at).toLocaleDateString('en-IN', {
                year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata'
              });

              const deliveryStatus = (order as any).email_delivery_status || 'pending';

              return (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">ORD-{shortId}</td>
                  <td className="px-6 py-4 text-gray-900">{order.customer_name || '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{order.customer_email || '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{order.customer_phone || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {order.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      deliveryStatus === 'delivered' 
                        ? 'bg-blue-100 text-blue-700' 
                        : deliveryStatus === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {deliveryStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">₹{order.amount || 0}</td>
                  <td className="px-6 py-4 text-gray-500">{date}</td>
                  <td className="px-6 py-4 text-right">
                    {order.status === 'paid' && (
                      <AdminResendReceiptButton orderId={order.id} />
                    )}
                  </td>
                </tr>
              );
            })}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-gray-500">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
