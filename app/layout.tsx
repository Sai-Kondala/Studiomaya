import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
import { ClientProviders } from "@/components/ClientProviders";

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
      <body className="antialiased">
        {/* Razorpay script injected securely via Next.js */}
        <Script 
          src="https://checkout.razorpay.com/v1/checkout.js" 
          strategy="beforeInteractive" 
        />
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}