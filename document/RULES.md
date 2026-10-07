# Development Rules
Studio Maya - Project Guidelines

## 1. General Principles
- **Design Consistency**: Maintain the minimalist, black-and-white, clean aesthetic. Do not unnecessarily alter existing UI layouts.
- **Security First**: Never trust client-side prices. Always verify product amounts against the database before initializing Razorpay.
- **Avoid Duplication**: Reuse existing components (e.g., Cart Drawer, Checkout logic).

## 2. Technology & Coding Standards
- **Language**: Strict TypeScript. Avoid `any` where possible.
- **Framework**: Next.js App Router (`app/` directory).
- **Client vs Server**: 
  - Use Server Components by default for data fetching (especially Admin pages).
  - Use `'use client'` only when React hooks (`useState`, `useEffect`) or browser APIs are required.
- **Styling**: Tailwind CSS. Ensure all interactive elements have proper hover/focus states.

## 3. Database Rules
- **Supabase Clients**:
  - Use the anonymous client (`@/lib/supabase`) for public data reads (e.g., fetching products on the homepage).
  - Use the Admin client (`@/lib/supabaseAdmin`) ONLY on the server for sensitive admin operations to securely bypass RLS.
- **Schema Mapping**: Always match exactly with the established database column names (e.g., `Customer_Phone` is case-sensitive).
