# Project File Structure
Studio Maya - Digital Product Store

```text
digital-store/
├── app/                              # Next.js App Router (Frontend & API)
│   ├── layout.tsx                    # Root layout (injects Cart Context, Razorpay script)
│   ├── page.tsx                      # Home page (Storefront product grid)
│   ├── globals.css                   # Global Tailwind styles
│   ├── about/
│   │   └── page.tsx                  # About, Contact, and Terms & Conditions
│   ├── cart-checkout/
│   │   └── page.tsx                  # Cart checkout form & payment flow
│   ├── products/
│   │   └── [id]/
│   │       └── page.tsx              # Individual product details page
│   ├── thank-you/
│   │   └── page.tsx                  # Post-purchase success page
│   ├── api/                          # Server API Routes
│   │   ├── create-order/             # Creates Razorpay order for "Buy Now"
│   │   ├── verify-payment/           # Verifies "Buy Now" payment & sends email
│   │   ├── cart-checkout/            # Creates Razorpay order for Cart
│   │   └── verify-cart-payment/      # Verifies Cart payment & sends emails
│   └── admin/                        # Protected Admin Dashboard
│       ├── layout.tsx                # Admin wrapper layout
│       ├── dashboard/
│       │   └── page.tsx              # Sales overview & charts (Server Component)
│       ├── products/
│       │   └── page.tsx              # Product management
│       ├── orders/
│       │   └── page.tsx              # Secure order history (Server Component)
│       ├── customers/
│       │   └── page.tsx              # Secure unique customer list (Server Component)
│       └── settings/
│           └── page.tsx              # Admin store settings
├── components/                       # Reusable React Components
│   ├── Navbar.tsx                    # Top navigation bar
│   ├── CheckoutButton.tsx            # "Buy Now" direct purchase button
│   ├── AddToCartButton.tsx           # Adds item to global cart
│   ├── CartContext.tsx               # React Context for cart state
│   ├── CartDrawer.tsx                # Slide-out shopping cart UI
│   ├── ClientProviders.tsx           # Wraps app in Context Providers
│   └── Footer.tsx                    # Global store footer
├── lib/                              # Utility and Helper Functions
│   ├── supabase.ts                   # Public anonymous Supabase client
│   └── supabaseAdmin.ts              # Secure Service Role Supabase client
├── document/                         # Project Documentation
│   ├── PRD.md                        # Product Requirements Document
│   ├── ARCHITECTURE.md               # System Architecture
│   ├── DESIGN.md                     # Design System
│   ├── RULES.md                      # Development Rules
│   ├── TASKS.md                      # Project Tasks
│   └── FILE_STRUCTURE.md             # This file
├── supabase/
│   └── setup.sql                     # Database schema definitions
└── middleware.ts                     # Protects /admin routes using Basic Auth
```
