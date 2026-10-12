import React from 'react';
import Link from 'next/link';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { redirect } from 'next/navigation';
import { getProductPrimaryImage } from '@/lib/productUtils';
import { Download, ExternalLink, Clock, ShoppingBag, ArrowLeft, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function CustomerOrdersPage({ searchParams }: PageProps) {
  const user = await getAuthenticatedUser();
  if (!user || !user.email) {
    redirect('/login?next=/account/orders');
  }

  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10));

  const supabaseAdmin = createSupabaseAdminClient();

  const emailFilter = user.email.trim();

  // 1. Fetch total count of customer's orders
  const { count, error: countError } = await supabaseAdmin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .ilike('customer_email', emailFilter);

  const totalOrders = count || 0;
  const totalPages = Math.ceil(totalOrders / PAGE_SIZE) || 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

  // 2. Fetch paginated orders belonging strictly to this customer
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, amount, status, created_at, razorpay_order_id, razorpay_payment_id')
    .ilike('customer_email', emailFilter)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (ordersError || countError) {
    console.error('Error fetching customer orders:', ordersError || countError);
  }

  const orderList = orders || [];
  const orderIds = orderList.map((o) => o.id);

  // 3. Fetch order items for these orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemsByOrder: Record<string, any[]> = {};
  if (orderIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select(`
        order_id,
        product_id,
        unit_price,
        product_name_snapshot,
        products (
          id,
          name,
          pdf_url,
          template_url,
          image_url
        )
      `)
      .in('order_id', orderIds);

    if (items) {
      itemsByOrder = items.reduce((acc, item) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      }, {} as Record<string, typeof items>);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-950 tracking-tight">
            My Purchases
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Access and download all digital products purchased with your account
          </p>
        </div>

        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </Link>
      </div>

      {orderList.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-xs">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-950">No purchases found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            You haven&apos;t completed any orders with this email yet.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block bg-black text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Browse Products Catalogue
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orderList.map((order) => {
            const shortId = order.id ? order.id.split('-')[0].toUpperCase() : 'N/A';
            const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Kolkata',
            });

            const orderItems = itemsByOrder[order.id] || [];
            const isPaid = order.status === 'paid';

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden"
              >
                {/* Order Meta Header */}
                <div className="bg-gray-50/70 p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-xs text-gray-400 uppercase tracking-wider block font-semibold">
                        Order Number
                      </span>
                      <span className="font-bold text-gray-950 text-sm">ORD-{shortId}</span>
                    </div>

                    <div className="border-l border-gray-200 pl-4">
                      <span className="text-xs text-gray-400 uppercase tracking-wider block font-semibold">
                        Date Placed
                      </span>
                      <span className="text-sm text-gray-600 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {orderDate}
                      </span>
                    </div>

                    <div className="border-l border-gray-200 pl-4">
                      <span className="text-xs text-gray-400 uppercase tracking-wider block font-semibold">
                        Total Amount
                      </span>
                      <span className="font-bold text-gray-950 text-sm">₹{order.amount || 0}</span>
                    </div>
                  </div>

                  <div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider ${
                        isPaid
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {isPaid ? 'Paid' : order.status === 'failed' ? 'Failed' : 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Items List & Downloads */}
                <div className="p-6 divide-y divide-gray-100">
                  {orderItems.length === 0 ? (
                    <div className="py-4 text-sm text-gray-500 italic">
                      Digital item details are syncing. Please check back shortly.
                    </div>
                  ) : (
                    orderItems.map((item, idx) => {
                      const product = Array.isArray(item.products) ? item.products[0] : item.products;
                      const productName =
                        product?.name || item.product_name_snapshot || 'Digital Product';
                      const productImage = product?.image_url
                        ? getProductPrimaryImage(product.image_url)
                        : '/hero_image.jpg';

                      return (
                        <div
                          key={idx}
                          className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-4">
                            <img
                              src={productImage || '/hero_image.jpg'}
                              alt={productName}
                              className="w-16 h-16 object-cover rounded-2xl border border-gray-100"
                            />
                            <div>
                              <h4 className="font-bold text-gray-950 text-base">{productName}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">
                                ₹{item.unit_price || 0} • Instant Digital Delivery
                              </p>
                            </div>
                          </div>

                          {/* Secure Download / Access Buttons (Only shown when order is verified as paid) */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            {isPaid ? (
                              <>
                                {product?.pdf_url && (
                                  <a
                                    href={`/api/account/download?orderId=${encodeURIComponent(
                                      order.id
                                    )}&productId=${encodeURIComponent(item.product_id)}`}
                                    className="inline-flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-800 transition-colors shadow-xs"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download PDF</span>
                                  </a>
                                )}

                                {product?.template_url && (
                                  <a
                                    href={product.template_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 bg-gray-100 text-gray-800 px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Access Notion Template</span>
                                  </a>
                                )}
                              </>
                            ) : (
                              <div className="text-xs text-gray-400 italic">
                                Downloads unlocked once payment confirmation is finalized.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                Page <strong className="text-gray-900">{currentPage}</strong> of{' '}
                <strong className="text-gray-900">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                {currentPage > 1 && (
                  <Link
                    href={`/account/orders?page=${currentPage - 1}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/account/orders?page=${currentPage + 1}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
