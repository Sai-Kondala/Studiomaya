import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EF] text-[#171717] font-sans pb-24">
      <Navbar />
      
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto bg-[#FAF8F5] p-8 md:p-12 rounded-2xl border border-[#C8B69A]/40 shadow-xs text-[#171717]">
          
          <div className="mb-10">
            <Link 
              href="/" 
              className="font-mono text-xs uppercase tracking-wider text-[#171717]/60 hover:text-[#171717] transition-colors flex items-center gap-2"
            >
              ← Back to Store
            </Link>
          </div>

          <div className="inline-block bg-[#FAF8F5] text-[#7A6953] border border-[#C8B69A]/50 text-[10px] font-mono uppercase tracking-widest font-semibold px-3 py-1 rounded-md mb-3">
            Customer Care &amp; Inquiries
          </div>

          <h1 className="text-3xl sm:text-4xl font-serif font-medium mb-4 tracking-tight text-[#171717]">
            Contact StudioMaya
          </h1>
          <p className="text-[#171717]/70 mb-8 text-sm sm:text-base leading-relaxed">
            Have questions about a template system or need support with your recent purchase? We&apos;re here to help.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email Contact */}
            <div className="bg-[#F7F4EF] p-6 sm:p-7 rounded-xl border border-[#C8B69A]/30">
              <div className="text-2xl mb-3">✉️</div>
              <h3 className="font-bold text-[#171717] mb-1 font-sans text-sm uppercase tracking-wider">Email Support</h3>
              <p className="text-[#171717]/65 mb-4 text-xs leading-relaxed">
                For order support, questions, or template inquiries, send us an email.
              </p>
              <a href="mailto:contact@studiomaya.co" className="text-[#171717] font-semibold hover:underline text-sm font-mono">
                contact@studiomaya.co
              </a>
            </div>

            {/* Phone Contact */}
            <div className="bg-[#F7F4EF] p-6 sm:p-7 rounded-xl border border-[#C8B69A]/30">
              <div className="text-2xl mb-3">📞</div>
              <h3 className="font-bold text-[#171717] mb-1 font-sans text-sm uppercase tracking-wider">Phone Support</h3>
              <p className="text-[#171717]/65 mb-4 text-xs leading-relaxed">
                Need direct assistance? Contact us during business hours.
              </p>
              <a href="tel:+916303180059" className="text-[#171717] font-semibold hover:underline text-sm font-mono">
                +91 6303 1800 59
              </a>
            </div>
          </div>

          <div className="mt-8 p-5 bg-[#FAF8F5] border border-[#C8B69A]/35 rounded-xl">
            <h3 className="font-semibold text-[#171717] mb-1 text-xs uppercase tracking-wider font-mono">Business Hours</h3>
            <p className="text-[#171717]/70 text-xs leading-relaxed">
              We typically respond within 24-48 hours during regular business hours (Monday-Friday, 9 AM - 5 PM IST).
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
