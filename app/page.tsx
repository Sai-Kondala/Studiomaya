import { supabase } from '../lib/supabase';
import { Navbar } from '@/components/Navbar';
import { ProductCatalog, ProductItem } from '@/components/ProductCatalog';
import { Sparkles, ArrowRight, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Fetch only products marked as 'Published'
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'Published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
  }

  const productList: ProductItem[] = products || [];

  return (
    <main className="min-h-screen bg-[#F7F4EF] text-[#171717] font-sans selection:bg-[#C8B69A]/30 overflow-x-clip">
      {/* Navigation Bar */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 px-6 sm:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left Column: Typography & CTAs */}
          <div className="flex-1 text-center lg:text-left z-10">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono tracking-[0.16em] uppercase font-semibold bg-[#FAF8F5] text-[#7A6953] border border-[#C8B69A]/45 mb-6 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C8B69A]" />
              <span>StudioMaya Systems • 2026 Collection</span>
            </div>

            {/* Main Editorial Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif text-[#171717] font-normal tracking-tight mb-6 leading-[1.12]">
              Notion Systems for <br />
              <span className="italic font-serif font-normal text-[#4A3B2C]">
                Clarity &amp; Flow
              </span>
            </h1>

            {/* Description */}
            <p className="text-[#171717]/70 text-base sm:text-lg mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed font-sans">
              Thoughtfully architected productivity tools, life organizers, and study systems designed to quiet the mental clutter and elevate your daily work.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
              <a
                href="#catalog"
                className="w-full sm:w-auto bg-[#171717] text-[#F7F4EF] px-7 py-3.5 rounded-md font-medium text-xs tracking-wider uppercase hover:bg-[#2E2822] transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Explore Systems</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform opacity-80" />
              </a>

              <a
                href="#benefits"
                className="w-full sm:w-auto bg-[#FAF8F5] text-[#171717] px-6 py-3.5 rounded-md font-medium text-xs tracking-wider uppercase border border-[#C8B69A]/60 hover:border-[#171717] hover:bg-white transition-all text-center cursor-pointer shadow-2xs"
              >
                Why StudioMaya
              </a>
            </div>

            {/* Social Proof / Trust Indicators */}
            <div className="flex items-center justify-center lg:justify-start gap-6 pt-3 text-xs text-[#171717]/65 border-t border-[#C8B69A]/30 max-w-md mx-auto lg:mx-0">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="text-amber-600 font-bold">★ 4.9/5</span>
                <span>Customer rating</span>
              </div>
              <span className="text-[#C8B69A]/60">•</span>
              <div>
                <span className="font-semibold text-[#171717]">3,200+</span> Downloads
              </div>
              <span className="text-[#C8B69A]/60">•</span>
              <div>
                <span>Instant Access</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Interactive Hero Experience */}
          <div className="flex-1 w-full max-w-lg lg:max-w-xl relative">
            {/* Ambient Lighting / Glow Orbs */}
            <div className="absolute -top-12 -left-12 w-72 h-72 bg-[#C8B69A]/25 rounded-full blur-3xl pointer-events-none animate-ambient-glow" />
            <div
              className="absolute -bottom-10 -right-8 w-64 h-64 bg-[#B8A5E8]/20 rounded-full blur-3xl pointer-events-none animate-ambient-glow"
              style={{ animationDelay: '3s' }}
            />

            {/* Floating 3D Showcase Container */}
            <div className="relative animate-float-slow">
              {/* Main Tablet Mockup */}
              <div className="relative rounded-3xl overflow-hidden shadow-[0_24px_50px_-12px_rgba(23,23,23,0.12)] border border-[#C8B69A]/40 bg-[#FAF8F5] p-2">
                <div className="rounded-2xl overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/hero_3d.jpg"
                    alt="3D Notion Workspace Mockup"
                    className="w-full h-auto object-cover transform hover:scale-[1.01] transition-transform duration-700 ease-out"
                  />
                </div>
              </div>

              {/* Floating 3D Micro-Card 1: Deep Work State (Top Right) */}
              <div className="absolute -top-5 -right-3 sm:-right-6 bg-[#FAF8F5]/95 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-[0_12px_28px_-6px_rgba(23,23,23,0.08)] border border-[#C8B69A]/45 flex items-center gap-3 animate-float-delayed">
                <div className="w-8 h-8 rounded-lg bg-[#EDE8F5] flex items-center justify-center text-[#5D4396] font-bold text-sm">
                  ⚡
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#171717]">Deep Work Block</p>
                  <p className="text-[10px] text-[#171717]/60 flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    90m Flow Session
                  </p>
                </div>
              </div>

              {/* Floating 3D Micro-Card 2: Habit Mastery (Bottom Left) */}
              <div className="absolute -bottom-5 -left-3 sm:-left-6 bg-[#FAF8F5]/95 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-[0_12px_28px_-6px_rgba(23,23,23,0.08)] border border-[#C8B69A]/45 flex items-center gap-3 animate-float-reverse">
                <div className="w-8 h-8 rounded-lg bg-[#EEF4EE] flex items-center justify-center text-[#386138] font-bold text-sm">
                  ✓
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#171717]">Daily Habits</p>
                  <p className="text-[10px] text-[#386138] font-semibold">21-Day Streak • 100%</p>
                </div>
              </div>

              {/* Floating 3D Micro-Card 3: Notion 3.0 Ready (Bottom Right) */}
              <div
                className="hidden sm:flex absolute bottom-8 -right-6 bg-[#FAF8F5]/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-[0_10px_20px_-6px_rgba(23,23,23,0.06)] border border-[#C8B69A]/45 items-center gap-2 animate-float-slow"
                style={{ animationDelay: '2.5s' }}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#8C5229]" />
                <span className="text-[11px] font-semibold text-[#8C5229]">Notion 3.0 Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Strip */}
      <section id="benefits" className="border-y border-[#C8B69A]/30 bg-[#FAF8F5]/70 py-12 px-6 sm:px-8 mb-16 scroll-mt-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#EDE8F5] text-[#5D4396] border border-[#B8A5E8]/30 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#171717] mb-1">1-Click Instant Duplicate</h4>
              <p className="text-xs text-[#171717]/65 leading-relaxed">
                Add directly into your personal or team Notion workspace with complete databases ready.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#EEF4EE] text-[#386138] border border-[#DCE8DC] flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#171717] mb-1">Lifetime Free Updates</h4>
              <p className="text-xs text-[#171717]/65 leading-relaxed">
                Get free access to future revisions, new database formulas, and upgraded Notion layouts.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#FAF2EC] text-[#8C5229] border border-[#E9CBB9]/60 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#171717] mb-1">Verified Productivity Flows</h4>
              <p className="text-xs text-[#171717]/65 leading-relaxed">
                Tested with real students and professionals to eliminate friction and focus on what counts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Products Catalog Section */}
      <section className="max-w-6xl mx-auto px-6 sm:px-8 pb-28">
        <div className="mb-8">
          <h2 className="text-3xl sm:text-4xl font-serif text-[#171717] tracking-tight mb-2">
            The Template Library
          </h2>
          <p className="text-[#171717]/65 text-sm">
            Select a system tailored to your current focus, studies, or business operations.
          </p>
        </div>

        {/* Dynamic Client Catalog with Animated Filter Tabs & Enhanced Cards */}
        <ProductCatalog initialProducts={productList} />
      </section>
    </main>
  );
}