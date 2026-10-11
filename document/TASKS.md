# Engineering Roadmap & Implementation Log
Studio Maya - Digital Commerce Platform

> [!NOTE]
> This tracker outlines completed milestones, active deliverables, and planned architectural enhancements for the Studio Maya project.

---

## 1. Development Timeline & Milestone Overview

```mermaid
flowchart TD
    classDef done fill:#16192b,stroke:#a855f7,stroke-width:2px,color:#f3e8ff
    classDef active fill:#1e1b4b,stroke:#38bdf8,stroke-width:2px,color:#e0f2fe
    classDef planned fill:#0d111d,stroke:#334155,stroke-width:1px,color:#94a3b8

    subgraph P1 ["Phase 1 &bull; Core Storefront (Sep 01 &ndash; Sep 15)"]
        direction LR
        P1_1["Next.js Setup & Tailwind"]:::done
        P1_2["Supabase DB & Storage"]:::done
        P1_3["Catalog Grid & Detail Page"]:::done
        P1_1 --> P1_2 --> P1_3
    end

    subgraph P2 ["Phase 2 &bull; Checkout & Delivery (Sep 16 &ndash; Sep 30)"]
        direction LR
        P2_1["Razorpay Integration"]:::done
        P2_2["Resend Email Engine"]:::done
        P2_3["Signed PDF Generator"]:::done
        P2_1 --> P2_2 --> P2_3
    end

    subgraph P3 ["Phase 3 &bull; Cart & Admin Panel (Oct 01 &ndash; Oct 08)"]
        direction LR
        P3_1["Shopping Cart Context"]:::done
        P3_2["Multi-Item Checkout API"]:::done
        P3_3["Admin Auth & Dashboard"]:::done
        P3_1 --> P3_2 --> P3_3
    end

    subgraph P4 ["Phase 4 &bull; Polish & Documentation (Oct 09 &ndash; Oct 11)"]
        direction LR
        P4_1["Multi-Image Upload"]:::done
        P4_2["Aspect Ratios & Limits"]:::done
        P4_3["Dark PDF Doc Engine"]:::done
        P4_1 --> P4_2 --> P4_3
    end

    subgraph P5 ["Phase 5 &bull; Future Scope (Oct 12+)"]
        direction LR
        P5_1["Customer Account History"]:::active
        P5_2["Coupons & Discounts"]:::planned
        P5_1 --> P5_2
    end

    P1 --> P2 --> P3 --> P4 --> P5
```

### Milestone Timeline Schedule

| Phase | Milestone / Focus | Timeline | Status | Key Deliverables |
| :--- | :--- | :--- | :---: | :--- |
| **Phase 1** | Core Foundation & Storefront | Sep 01 &ndash; Sep 15, 2026 | `DONE` | Next.js 16, Supabase PostgreSQL, Product Grid & Details |
| **Phase 2** | Checkout & Digital Delivery | Sep 16 &ndash; Sep 30, 2026 | `DONE` | Razorpay Direct Buy, Resend Transactional Emails, Signed S3/Storage URLs |
| **Phase 3** | Shopping Cart & Admin Portal | Oct 01 &ndash; Oct 08, 2026 | `DONE` | Persistent Cart State, Multi-Item Checkout API, Admin Auth & Dashboard |
| **Phase 4** | Platform Polish & Engine Docs | Oct 09 &ndash; Oct 11, 2026 | `DONE` | Multi-Image Upload, Aspect Ratio Lock, Headless Markdown-to-PDF Engine |
| **Phase 5** | User Accounts & Promotions | Oct 12 &ndash; Oct 31, 2026 | `ACTIVE` | Customer Purchase History Portal, Promotional Coupon System |


---

## 2. Completed Milestones

### Phase 1: Core Foundation & Storefront
- [x] Initialize Next.js 16 project with App Router and Tailwind CSS.
- [x] Establish Supabase PostgreSQL database schemas (`products`, `orders`, `customers`).
- [x] Configure Supabase Storage buckets (`product-images`, `product-files`).
- [x] Build responsive public storefront grid (`/`) and product details page (`/products/[id]`).

### Phase 2: Payment Gateway & Automated Fulfillment
- [x] Implement direct "Buy Now" Razorpay checkout modal (`CheckoutButton.tsx`).
- [x] Build `/api/create-order` endpoint with canonical price verification.
- [x] Build `/api/verify-payment` endpoint with HMAC-SHA256 signature verification.
- [x] Create 7-day signed download URLs for private digital files.
- [x] Integrate Resend transactional email API for immediate delivery of receipts and download links.

### Phase 3: Shopping Cart & Administrative Suite
- [x] Implement persistent client-side cart state with React Context (`CartContext.tsx`).
- [x] Build animated slide-out Cart Drawer component (`CartDrawer.tsx`).
- [x] Create batch cart checkout endpoint (`/api/cart-checkout`) and batch verification (`/api/verify-cart-payment`).
- [x] Protect administrative routes (`/admin/*`) using Next.js Edge Middleware and `admin_users` table whitelist.
- [x] Build Admin Dashboard overview with sales metrics and monthly performance charts.
- [x] Build Admin Orders page with real-time transaction history.
- [x] Build Admin Customers page tracking unique buyers and purchase frequencies.

### Phase 4: Media Architecture & Documentation System
- [x] Enable multiple product image uploads with cover image reassignment in Add/Edit product views.
- [x] Refactor `ProductGallery.tsx` with `object-contain` to preserve exact aspect ratios for portrait, square, and landscape visuals without cropping or distortion.
- [x] Enforce strict upload limits (max 2 MB per image, max 5 MB for PDF) with client alerts and server checks.
- [x] Configure Next.js Server Action body size limit to 10 MB in `next.config.ts`.
- [x] Implement reusable dark Markdown-to-PDF documentation generator (`scripts/export-pdf.mjs`, `styles/theme.css`, `templates/document.html`).

---

## 3. Active & Upcoming Deliverables

### Phase 5: Future Enhancements
- [ ] **Customer Portal (Optional)**: Magic-link login allowing buyers to access lifetime purchased digital libraries.
- [ ] **Discount Codes & Coupons**: Promotional discounts calculated server-side during checkout.
- [ ] **Automated PDF Stamping**: Dynamically stamp buyer's email onto purchased PDF guides to discourage unauthorized redistribution.
- [ ] **Webhook Backup**: Add Razorpay webhook listener to fulfill orders if user closes browser before client-side verification completes.
