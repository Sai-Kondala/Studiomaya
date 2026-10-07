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
      <body className="antialiased flex flex-col min-h-screen bg-gray-50">
        {/* Razorpay script injected securely via Next.js */}
        <Script 
          src="https://checkout.razorpay.com/v1/checkout.js" 
          strategy="beforeInteractive" 
        />
        <ClientProviders>
          {children}
        </ClientProviders>
        <Footer />
      </body>
    </html>
  );
}