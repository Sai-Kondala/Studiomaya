import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

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
        {/* Razorpay script injected securely */}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}