import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EF] text-[#171717] font-sans pb-24">
      <Navbar />
      
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-[#FAF8F5] p-8 md:p-12 rounded-2xl border border-[#C8B69A]/40 shadow-xs text-[#171717]">
          
          {/* Navigation */}
          <div className="mb-10">
            <Link 
              href="/" 
              className="font-mono text-xs uppercase tracking-wider text-[#171717]/60 hover:text-[#171717] transition-colors flex items-center gap-2"
            >
              ← Back to Store
            </Link>
          </div>

          {/* About Section */}
          <section id="about" className="mb-14">
            <div className="inline-block bg-[#FAF8F5] text-[#7A6953] border border-[#C8B69A]/50 text-[10px] font-mono uppercase tracking-widest font-semibold px-3 py-1 rounded-md mb-3">
              Independent Creative Studio
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-medium mb-6 tracking-tight text-[#171717]">
              About StudioMaya
            </h1>
            <div className="text-[#171717]/70 space-y-4 leading-relaxed text-sm sm:text-base">
              <p>
                Welcome to <strong>StudioMaya</strong>. We specialize in crafting premium digital products designed to help you organize your life, boost your productivity, and streamline your workflow.
              </p>
              <p>
                Our mission is to build beautifully designed, highly functional digital tools that feel seamless to use. From Notion dashboards to in-depth systems and templates, every product in our store is carefully designed with extreme attention to detail and user experience.
              </p>
            </div>
          </section>

          <hr className="border-[#C8B69A]/30 my-10" />

          {/* Terms and Conditions Section */}
          <section id="terms">
            <h2 className="text-2xl sm:text-3xl font-serif font-medium mb-6 tracking-tight text-[#171717]">
              Terms and Conditions
            </h2>
            <div className="space-y-6 text-[#171717]/70 text-sm leading-relaxed">
              <div>
                <h3 className="text-base font-bold text-[#171717] mb-1 font-sans">1. Digital Products</h3>
                <p>
                  All products sold on StudioMaya are digital downloads. No physical products will be shipped to you. Upon successful payment, you will receive an email containing the links to download or access your digital templates and files.
                </p>
              </div>
              
              <div>
                <h3 className="text-base font-bold text-[#171717] mb-1 font-sans">2. Refunds and Returns</h3>
                <p>
                  Due to the non-returnable nature of digital products, all sales are final. We do not offer refunds, exchanges, or cancellations once the digital files have been delivered. If you experience any technical issues with your files, please contact our support team.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#171717] mb-1 font-sans">3. Licensing and Usage</h3>
                <p>
                  When you purchase a product from StudioMaya, you are granted a single-user, non-exclusive license. You may not share, resell, redistribute, or reproduce the templates or files in any form, modified or unmodified, without explicit written permission.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#171717] mb-1 font-sans">4. Privacy</h3>
                <p>
                  Your privacy is important to us. We securely process payments through Razorpay and only store the email and name you provide during checkout for the sole purpose of delivering your files and providing customer support. We will never sell your data to third parties.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
