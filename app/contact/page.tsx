import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Navbar />
      
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 shadow-sm rounded-3xl border border-gray-100 text-gray-900">
          
          <div className="mb-12">
            <Link href="/" className="text-gray-500 hover:text-black font-medium transition-colors flex items-center gap-2">
              ← Back to Store
            </Link>
          </div>

          <h1 className="text-4xl font-bold mb-6 tracking-tight">Contact Us</h1>
          <p className="text-gray-600 mb-8 text-lg">
            Have questions about a product or need support with your recent purchase? We're here to help.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email Contact */}
            <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100">
              <div className="text-2xl mb-4">✉️</div>
              <h3 className="font-bold text-gray-900 mb-2">Email Support</h3>
              <p className="text-gray-600 mb-4 text-sm">
                For order support, refunds, or technical issues, send us an email.
              </p>
              <a href="mailto:contact@studiomaya.co" className="text-black font-semibold hover:underline text-lg">
                contact@studiomaya.co
              </a>
            </div>

            {/* Phone Contact */}
            <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100">
              <div className="text-2xl mb-4">📞</div>
              <h3 className="font-bold text-gray-900 mb-2">Phone Support</h3>
              <p className="text-gray-600 mb-4 text-sm">
                Need immediate assistance? Give us a call during business hours.
              </p>
              <a href="tel:+916303180059" className="text-black font-semibold hover:underline text-lg">
                +91 6303 1800 59
              </a>
            </div>
          </div>

          <div className="mt-12 p-6 bg-blue-50 border border-blue-100 rounded-2xl">
            <h3 className="font-bold text-blue-900 mb-2">Business Hours</h3>
            <p className="text-blue-800 text-sm">
              We typically respond within 24-48 hours during regular business hours (Monday-Friday, 9 AM - 5 PM IST).
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
