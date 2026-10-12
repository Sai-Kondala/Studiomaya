import React from 'react';
import Link from 'next/link';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { redirect } from 'next/navigation';
import { ShoppingBag, ArrowRight, Package, Clock, Calendar, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AccountOverviewPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login?next=/account');
  }

  const supabaseAdmin = createSupabaseAdminClient();

  // Fetch customer orders by email
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, amount, status, created_at, razorpay_order_id, razorpay_payment_id')
    .eq('customer_email', user.email)
    .order('created_at', { ascending: false });

  if (ordersError) {
    console.error('Error fetching customer orders in overview:', ordersError);
  }

  const allOrders = orders || [];
  const paidOrders = allOrders.filter((o) => o.status === 'paid');
  const totalPurchases = paidOrders.length;
  const recentOrders = allOrders.slice(0, 3);
  const recentOrderIds = recentOrders.map((o) => o.id);

  // Fetch product names for recent orders from order_items
  let itemsByOrder: Record<string, string[]> = {};
  if (recentOrderIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('order_id, product_name_snapshot, products(name)')
      .in('order_id', recentOrderIds);

    if (items) {
      itemsByOrder = items.reduce((acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prod = item.products as any;
        const name =
          item.product_name_snapshot ||
          (Array.isArray(prod) ? prod[0]?.name : prod?.name) ||
          'Digital Product';
        acc[item.order_id].push(name);
        return acc;
      }, {} as Record<string, string[]>);
    }
  }

  const customerName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Customer';

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="space-y-8">
      {/* Welcome Card & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-3xl p-8 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Account Overview
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-950 mt-1">
              Hello, {customerName} 👋
            </h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Welcome to your Studio Maya dashboard. Here you can access all your digital purchases, track order receipts, and manage your saved items.
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wider block">Email</span>
              <span className="font-semibold text-gray-900">{user.email}</span>
            </div>
            {memberSince && (
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wider block">Member Since</span>
                <span className="font-semibold text-gray-900 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {memberSince}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Purchases Stat Card */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center text-gray-900 mb-4">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Purchases
            </span>
            <div className="text-4xl font-extrabold text-gray-950 mt-1">
              {totalPurchases}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Confirmed digital templates & workspaces
            </p>
          </div>

          <Link
            href="/account/orders"
            className="mt-6 inline-flex items-center justify-between w-full text-sm font-semibold text-gray-900 hover:text-black group pt-4 border-t border-gray-100"
          >
            <span>View All Purchases</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-950">Recent Orders</h3>
            <p className="text-xs text-gray-500 mt-0.5">Your most recent purchases and their current status</p>
          </div>
          <Link
            href="/account/orders"
            className="text-xs font-semibold text-gray-600 hover:text-black flex items-center gap-1"
          >
            <span>All Orders ({allOrders.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-900 text-sm">No purchases yet</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              You haven&apos;t placed any orders yet. Explore our templates catalogue to get started!
            </p>
            <Link
              href="/"
              className="mt-4 inline-block bg-black text-white px-5 py-2.5 rounded-xl text-xs font-medium hover:bg-gray-800 transition-colors"
            >
              Browse Templates
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentOrders.map((order) => {
              const shortId = order.id ? order.id.split('-')[0].toUpperCase() : 'N/A';
              const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              const productNames = itemsByOrder[order.id]?.join(', ') || `Order ORD-${shortId}`;

              return (
                <div key={order.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 shrink-0 mt-0.5">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-950">{productNames}</span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            order.status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {order.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span className="font-mono text-gray-400">ORD-{shortId}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {orderDate}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-gray-900">₹{order.amount || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {order.status === 'paid' ? (
                      <Link
                        href="/account/orders"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Access Files</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">Pending verification</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link
          href="/cart-checkout"
          className="bg-white p-6 rounded-3xl border border-gray-100 hover:border-gray-300 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-gray-950">Saved Cart</span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-black transition-transform group-hover:translate-x-1" />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Review your persistent shopping cart and proceed to checkout with 7-day retention.
          </p>
        </Link>

        <Link
          href="/"
          className="bg-white p-6 rounded-3xl border border-gray-100 hover:border-gray-300 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-gray-950">Store Catalogue</span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-black transition-transform group-hover:translate-x-1" />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Discover new study planners, productivity dashboards, and finance trackers.
          </p>
        </Link>
      </div>
    </div>
  );
}
