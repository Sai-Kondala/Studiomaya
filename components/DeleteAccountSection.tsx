'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { useCart } from './CartContext';

export function DeleteAccountSection() {
  const router = useRouter();
  const { clearCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = () => {
    if (isDeleting) return;
    setIsOpen(false);
    setErrorMessage(null);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setErrorMessage(null);

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete account. Please try again.');
      }

      // Clear local client state & Supabase browser session
      try {
        clearCart();
        localStorage.removeItem('digital-store-cart');
        const supabase = getSupabaseBrowserClient();
        await supabase.auth.signOut();
      } catch (clientErr) {
        console.warn('Post-deletion client cleanup warning:', clientErr);
      }

      // Redirect user to home page with clean reload
      window.location.href = '/?account_deleted=1';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while deleting your account.';
      setErrorMessage(message);
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Danger Zone Container in Overview */}
      <div className="bg-[#FAF8F5] rounded-2xl p-8 border border-red-200/60 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <h3 className="text-lg font-serif font-medium text-[#171717]">Danger Zone</h3>
            </div>
            <p className="text-xs text-[#171717]/60 leading-relaxed max-w-xl">
              Permanently delete your account and all associated order records, downloads, and cart history.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setIsOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs font-semibold uppercase tracking-wider hover:bg-red-700 hover:text-white transition-all cursor-pointer shadow-2xs active:scale-98"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-[#FAF8F5] w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-2xl border border-[#C8B69A]/40 text-[#171717] animate-in zoom-in-95 duration-200 relative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon & Title */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-account-title" className="text-lg font-extrabold text-gray-950">
                  Delete Account
                </h3>
                <span className="text-xs text-red-600 font-semibold uppercase tracking-wider">
                  Irreversible Action
                </span>
              </div>
            </div>

            {/* Warning Message Box */}
            <div className="bg-red-50 border border-red-200/80 rounded-2xl p-4 mb-4 text-xs leading-relaxed text-red-800">
              <p className="font-semibold text-red-900 mb-1">
                Warning:
              </p>
              <p>
                You will lose all the templates you purchased! You can&apos;t access them anymore from this account if you have not stored or duplicated them.
              </p>
            </div>

            {/* Small text confirmation prompt */}
            <p className="text-xs text-gray-600 mb-6 font-medium">
              Are you sure you want to delete your account?
            </p>

            {/* Error Message if deletion failed */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {errorMessage}
              </div>
            )}

            {/* Action Buttons: Yes and No */}
            <div className="flex flex-col-reverse sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 text-center"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs text-center"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
