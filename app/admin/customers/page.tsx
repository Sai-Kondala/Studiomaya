import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminCustomers() {
  const supabase = createSupabaseAdminClient();
  
  // Fetch all orders to extract unique customers
  const { data: orders, error } = await supabase
    .from('orders')
    .select('customer_email, customer_name, customer_phone, created_at')
    .order('created_at', { ascending: false });

  // Deduplicate customers by email
  const uniqueCustomersMap = new Map();
  if (orders) {
    for (const order of orders) {
      if (!order.customer_email) continue;
      
      const email = order.customer_email.toLowerCase();
      if (!uniqueCustomersMap.has(email)) {
        uniqueCustomersMap.set(email, {
          email: order.customer_email,
          full_name: order.customer_name,
          phone: order.customer_phone,
          created_at: order.created_at
        });
      }
    }
  }
  
  const customers = Array.from(uniqueCustomersMap.values());

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Customers</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
            <tr>
              <th className="px-6 py-4 font-medium">Customer Name</th>
              <th className="px-6 py-4 font-medium">Email</th>
              <th className="px-6 py-4 font-medium">Phone Number</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {customers?.map((customer, index) => (
              <tr key={index} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-6 py-4 font-medium text-gray-900">{customer.full_name || '—'}</td>
                <td className="px-6 py-4 text-gray-500">{customer.email || '—'}</td>
                <td className="px-6 py-4 text-gray-500">{customer.phone || '—'}</td>
              </tr>
            ))}
            {(!customers || customers.length === 0) && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
