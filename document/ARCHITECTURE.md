# System Architecture
Studio Maya - Digital Product Store

## 1. High-Level Architecture
Studio Maya follows a modern full-stack architecture using Next.js for both frontend and backend API routes, Supabase for the database and storage, and Razorpay for payment processing.

## 2. Technology Stack
| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| Frontend | Next.js (App Router) | React framework for UI |
| Language | TypeScript | Type safety and reliable code |
| Styling | Tailwind CSS | Utility-first responsive styling |
| Backend | Next.js API Routes | Server-side logic (checkout, verification) |
| Database | Supabase (PostgreSQL) | Relational data (products, orders, customers) |
| Storage | Supabase Storage | Secure hosting for digital assets (PDFs, images) |
| Payments | Razorpay | Secure transaction processing |
| Email | Resend | Transactional email delivery (receipts/files) |

## 3. Core Data Models
- **Products**: Stores product details (name, price, image_url, file_urls).
- **Orders**: Tracks individual purchases, linked to Razorpay order and payment IDs.
- **Customers**: Tracks unique buyers derived from successful orders.

## 4. Security & Access
- Admin routes (`/admin/*`) are protected by Next.js Middleware.
- Admin pages use `createSupabaseAdminClient` (Service Role Key) to securely bypass RLS for data management.
- Prices are strictly verified on the server-side during checkout to prevent client-side manipulation.
