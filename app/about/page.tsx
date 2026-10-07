import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Navbar />
      
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 shadow-sm rounded-3xl border border-gray-100 text-gray-900">
          
          {/* Navigation */}
          <div className="mb-12">
          <Link href="/" className="text-gray-500 hover:text-black font-medium transition-colors flex items-center gap-2">
            ← Back to Store
          </Link>
        </div>

        {/* About Section */}
        <section id="about" className="mb-16">
          <h1 className="text-4xl font-bold mb-6 tracking-tight">About Studio Maya</h1>
          <div className="prose prose-lg text-gray-600 space-y-4">
            <p>
              Welcome to <strong>Studio Maya</strong>. We specialize in crafting premium digital products designed to help you organize your life, boost your productivity, and streamline your workflow.
            </p>
            <p>
              Our mission is to build beautifully designed, highly functional digital tools that feel seamless to use. From Notion dashboards to in-depth guides and templates, every product in our store is carefully designed with extreme attention to detail and user experience.
            </p>
          </div>
        </section>

        <hr className="border-gray-100 my-12" />

        {/* Removed Contact Section - Now on its own page */}

        {/* Terms and Conditions Section */}
        <section id="terms">
          <h2 className="text-3xl font-bold mb-6 tracking-tight">Terms and Conditions</h2>
          <div className="space-y-6 text-gray-600 text-base leading-relaxed">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">1. Digital Products</h3>
              <p>
                All products sold on Studio Maya are digital downloads. No physical products will be shipped to you. Upon successful payment, you will receive an email containing the links to download or access your digital templates and files.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">2. Refunds and Returns</h3>
              <p>
                Due to the non-returnable nature of digital products, all sales are final. We do not offer refunds, exchanges, or cancellations once the digital files have been delivered. If you experience any technical issues with your files, please contact our support team.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">3. Licensing and Usage</h3>
              <p>
                When you purchase a product from Studio Maya, you are granted a single-user, non-exclusive license. You may not share, resell, redistribute, or reproduce the templates or files in any form, modified or unmodified, without explicit written permission.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">4. Privacy</h3>
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
