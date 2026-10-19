import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
import { ClientProviders } from "@/components/ClientProviders";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Studio Maya",
  description: "Premium digital workspaces",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased flex flex-col min-h-screen bg-[#F7F4EF] text-[#171717] selection:bg-[#C8B69A]/30 selection:text-[#171717]">
        {/* Razorpay script loaded with afterInteractive to prevent hydration blocking */}
        <Script 
          src="https://checkout.razorpay.com/v1/checkout.js" 
          strategy="afterInteractive" 
        />
        <ClientProviders>
          {children}
        </ClientProviders>
        <Footer />
      </body>
    </html>
  );
}