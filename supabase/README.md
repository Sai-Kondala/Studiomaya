# Studio Maya Database Migrations & Reproducibility Guide

This directory maintains the database schema, security policies, and reproducible migrations for the Studio Maya digital store on Supabase PostgreSQL.

---

## 1. Quick Start for Fresh Environments

For a fresh deployment or staging Supabase project, execute `supabase/setup.sql` in the **Supabase Dashboard → SQL Editor**. It creates all tables, foreign keys, constraints, indexes, RLS policies, and maintenance functions idempotently.

```bash
# Alternatively via Supabase CLI (if linked):
supabase db push
# Or execute setup.sql:
psql $DATABASE_URL -f supabase/setup.sql
```

---

## 2. Migration History (Chronological Order)

| Migration File | Description | Key Changes |
| :--- | :--- | :--- |
| `20261012_customer_auth_and_cart.sql` | Customer accounts, persistent cart, RLS | Creates `public.customers` (linked to `auth.users`), `public.carts`, `public.cart_items`. Adds `user_id` and `customer_id` to `public.orders`. Configures strict Row Level Security (RLS) on all customer tables. Adds `cleanup_expired_carts()` routine. |
| `20261013_order_email_delivery_status.sql` | Order email delivery lifecycle tracking | Adds `email_delivery_status TEXT DEFAULT 'pending'` and index `idx_orders_email_delivery_status` to `public.orders`. |

---

## 3. Schema Reference & Relationships

### `public.customers`
- **`id`** `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **`user_id`** `UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE`
- **`full_name`** `TEXT NOT NULL`
- **`email`** `TEXT NOT NULL UNIQUE`
- **`phone`** `TEXT`
- **`created_at`** / **`updated_at`** `TIMESTAMPTZ DEFAULT NOW()`

### `public.orders` (Key Extensions)
- **`user_id`** `UUID REFERENCES auth.users(id) ON DELETE SET NULL`: Identifies verified account ownership.
- **`customer_id`** `UUID REFERENCES public.customers(id) ON DELETE SET NULL`
- **`email_delivery_status`** `TEXT DEFAULT 'pending'`: Tracks `'pending'`, `'sent'`, `'delivered'`, `'failed'`, `'bounced'`, `'delayed'`.

### `public.carts` & `public.cart_items`
- **`carts.user_id`** `UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE`
- **`carts.updated_at`** `TIMESTAMPTZ DEFAULT NOW()`: Refreshed on activity; used for 7-day lifecycle.
- **`cart_items.product_id`** `UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE`
- **Constraint**: `UNIQUE (cart_id, product_id)`

---

## 4. Row Level Security (RLS) Policies

All tables handling customer-specific data have RLS enabled:
- **`customers`**: Users can only `SELECT`, `INSERT`, and `UPDATE` their own profile where `auth.uid() = user_id`.
- **`carts` & `cart_items`**: Users can only access and modify cart items where `carts.user_id = auth.uid()`.
- **`orders` & `order_items`**: Customers can view orders where `auth.uid() = user_id` OR `customer_email = auth.jwt() ->> 'email'`. Order insertions and state transitions are executed securely via server API using `SUPABASE_SERVICE_ROLE_KEY`.

---

## 5. Storage Buckets

- **`product-files`**: Private bucket storing downloadable assets (`.pdf`, etc.). Access is restricted; download links are generated server-side via short-lived signed URLs (15 minutes for customer downloads, 24 hours for email receipt links).
