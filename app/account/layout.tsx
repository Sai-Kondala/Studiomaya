import React from 'react';
import { getAuthenticatedUser } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AccountTabs } from '@/components/AccountTabs';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login?next=/account');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 w-full flex-1">
        {/* Account Header */}
        <div className="mb-8 border-b border-gray-200 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-950 tracking-tight">
              Customer Account
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Signed in as <span className="font-semibold text-gray-800">{user.email}</span>
            </p>
          </div>

          {/* Quick Tabs */}
          <AccountTabs />
        </div>

        {/* Content Body */}
        <main>{children}</main>
      </div>
    </div>
  );
}
