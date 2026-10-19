import React from 'react';
import Link from 'next/link';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { redirect } from 'next/navigation';
import { ShoppingBag, ArrowRight, Package, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { DeleteAccountSection } from '@/components/DeleteAccountSection';

export const dynamic = 'force-dynamic';

export default async function AccountOverviewPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login?next=/account');
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const normalizedEmail = user.email ? user.email.trim().toLowerCase() : '';

  // Fetch customer orders: owned by authenticated user_id OR unclaimed guest orders matching email
  let { data: rawOrders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, amount, status, created_at, razorpay_order_id, razorpay_payment_id, user_id, customer_email')
    .or(`user_id.eq.${user.id},and(user_id.is.null,customer_email.eq."${normalizedEmail}")`)
    .order('created_at', { ascending: false });

  // Fallback for environments where user_id column is pending
  if (ordersError && (ordersError.code === '42703' || ordersError.code === 'PGRST204' || (typeof ordersError.message === 'string' && ordersError.message.includes('user_id')))) {
    const fallback = await supabaseAdmin
      .from('orders')
      .select('id, amount, status, created_at, razorpay_order_id, razorpay_payment_id, customer_email')
      .eq('customer_email', normalizedEmail)
      .order('created_at', { ascending: false });
    rawOrders = fallback.data as any;
    ordersError = fallback.error;
  }

  if (ordersError) {
    console.error('Error fetching customer orders in overview:', ordersError);
  }

  // Enforce ownership:
  const allOrders = (rawOrders || []).filter((order: any) => {
    if (order.user_id) {
      return order.user_id === user.id;
    }
    const orderEmail = order.customer_email ? order.customer_email.trim().toLowerCase() : '';
    return orderEmail === normalizedEmail;
  });

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
        <div className="md:col-span-2 bg-[#FAF8F5] rounded-2xl p-8 border border-[#C8B69A]/35 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#7A6953] font-semibold">
              Account Overview
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-medium text-[#171717] mt-1">
              Hello, {customerName} 👋
            </h2>
            <p className="text-xs text-[#171717]/65 mt-2 leading-relaxed font-sans">
              Welcome to your StudioMaya dashboard. Here you can access all your digital purchases, track order receipts, and manage your saved items.
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-[#C8B69A]/20 flex flex-wrap gap-6 text-xs">
            <div>
              <span className="text-[10px] font-mono text-[#171717]/50 uppercase tracking-wider block">Email</span>
              <span className="font-semibold text-[#171717] font-mono">{user.email}</span>
            </div>
            {memberSince && (
              <div>
                <span className="text-[10px] font-mono text-[#171717]/50 uppercase tracking-wider block">Member Since</span>
                <span className="font-semibold text-[#171717] flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-[#C8B69A]" />
                  {memberSince}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Purchases Stat Card */}
        <div className="bg-[#FAF8F5] rounded-2xl p-8 border border-[#C8B69A]/35 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-[#F7F4EF] border border-[#C8B69A]/30 rounded-xl flex items-center justify-center text-[#171717] mb-4">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#7A6953] font-semibold">
              Purchases
            </span>
            <div className="text-4xl font-bold font-sans text-[#171717] mt-1">
              {totalPurchases}
            </div>
            <p className="text-xs text-[#171717]/60 mt-1 font-sans">
              Confirmed digital templates &amp; workspaces
            </p>
          </div>

          <Link
            href="/account/orders"
            className="mt-6 inline-flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-[#171717] hover:text-[#5D4396] group pt-4 border-t border-[#C8B69A]/20"
          >
            <span>View All Purchases</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-[#FAF8F5] rounded-2xl p-8 border border-[#C8B69A]/35 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-serif font-medium text-[#171717]">Recent Orders</h3>
            <p className="text-xs text-[#171717]/60 mt-0.5">Your most recent purchases and their current status</p>
          </div>
          <Link
            href="/account/orders"
            className="text-xs font-mono uppercase tracking-wider text-[#171717]/70 hover:text-[#171717] flex items-center gap-1"
          >
            <span>All Orders ({allOrders.length})</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-12 bg-[#F7F4EF] rounded-xl border border-dashed border-[#C8B69A]/40">
            <ShoppingBag className="w-10 h-10 text-[#C8B69A] mx-auto mb-3" />
            <h4 className="font-serif font-medium text-[#171717] text-base">No purchases yet</h4>
            <p className="text-xs text-[#171717]/60 mt-1 max-w-sm mx-auto font-sans">
              You haven&apos;t placed any orders yet. Explore our templates catalogue to get started!
            </p>
            <Link
              href="/#catalog"
              className="mt-4 inline-block bg-[#171717] text-[#F7F4EF] px-5 py-2.5 rounded-md text-xs uppercase tracking-wider font-medium hover:bg-[#2E2822] transition-colors"
            >
              Browse Templates
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#C8B69A]/20">
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
                    <div className="w-10 h-10 rounded-xl bg-[#F7F4EF] border border-[#C8B69A]/30 flex items-center justify-center text-[#171717] shrink-0 mt-0.5">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-medium text-base text-[#171717]">{productNames}</span>
                        <span
                          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md font-semibold ${
                            order.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {order.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#171717]/60 mt-1 font-mono">
                        <span>ORD-{shortId}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-sans">
                          <Clock className="w-3 h-3 text-[#C8B69A]" /> {orderDate}
                        </span>
                        <span>•</span>
                        <span className="font-bold text-[#171717] font-sans">₹{order.amount || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {order.status === 'paid' ? (
                      <Link
                        href="/account/orders"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-[#171717] text-[#F7F4EF] px-4 py-2 rounded-md hover:bg-[#2E2822] transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Access Files</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-[#171717]/40 font-mono">Pending verification</span>
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
          className="bg-[#FAF8F5] p-6 rounded-2xl border border-[#C8B69A]/35 hover:border-[#C8B69A]/80 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-serif font-medium text-lg text-[#171717]">Saved Cart</span>
            <ArrowRight className="w-4 h-4 text-[#C8B69A] group-hover:text-[#171717] transition-transform group-hover:translate-x-1" />
          </div>
          <p className="text-xs text-[#171717]/65 leading-relaxed font-sans">
            Review your persistent shopping cart and proceed to checkout with 7-day retention.
          </p>
        </Link>

        <Link
          href="/#catalog"
          className="bg-[#FAF8F5] p-6 rounded-2xl border border-[#C8B69A]/35 hover:border-[#C8B69A]/80 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-serif font-medium text-lg text-[#171717]">Store Catalogue</span>
            <ArrowRight className="w-4 h-4 text-[#C8B69A] group-hover:text-[#171717] transition-transform group-hover:translate-x-1" />
          </div>
          <p className="text-xs text-[#171717]/65 leading-relaxed font-sans">
            Discover new study planners, productivity dashboards, and finance trackers.
          </p>
        </Link>
      </div>

      {/* Danger Zone: Account Deletion */}
      <DeleteAccountSection />
    </div>
  );
}
