import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 font-bold text-xl">
          Studio Maya
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2">
          <Link href="/admin" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Dashboard</Link>
          <Link href="/admin/products" className="block px-4 py-2 bg-gray-100 text-black font-medium rounded-lg">Products</Link>
          <Link href="/admin/orders" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Orders</Link>
          <Link href="/admin/customers" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Customers</Link>
          <Link href="/admin/settings" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Settings</Link>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}