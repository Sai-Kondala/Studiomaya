import { createSupabaseAdminClient } from './supabaseAdmin';
import { getProductPrimaryImage } from './productUtils';

export const CART_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface NormalizedCartItem {
  id: string;
  name: string;
  price: number;
  image_url: string;
}

/**
 * Checks whether a cart timestamp is older than 7 days.
 */
export function isCartExpired(updatedAt: string | Date): boolean {
  const lastActive = new Date(updatedAt).getTime();
  if (isNaN(lastActive)) return false;
  return Date.now() - lastActive > CART_EXPIRATION_MS;
}

/**
 * Retrieves the active cart items for a given authenticated user.
 * Performs lazy expiration cleanup if the cart has been inactive for > 7 days.
 */
export async function getUserCartItems(userId: string): Promise<{ items: NormalizedCartItem[]; expired: boolean }> {
  const supabase = createSupabaseAdminClient();

  try {
    // 1. Fetch user's active cart
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('id, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (cartError) {
      // If table doesn't exist yet, return gracefully
      return { items: [], expired: false };
    }

    if (!cart) {
      return { items: [], expired: false };
    }

    // 2. Check 7-day expiration rule
    if (isCartExpired(cart.updated_at)) {
      // Lazy cleanup: delete expired cart (cart_items cascade)
      await supabase.from('carts').delete().eq('id', cart.id);
      return { items: [], expired: true };
    }

    // 3. Fetch cart items joined with products
    const { data: items, error: itemsError } = await supabase
      .from('cart_items')
      .select(`
        product_id,
        products (
          id,
          name,
          price,
          image_url,
          status
        )
      `)
      .eq('cart_id', cart.id);

    if (itemsError || !items) {
      return { items: [], expired: false };
    }

    const normalizedItems: NormalizedCartItem[] = [];

    for (const item of items) {
      // Handle Supabase foreign table query format
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      if (product && product.status === 'Published') {
        normalizedItems.push({
          id: product.id,
          name: product.name,
          price: Number(product.price),
          image_url: getProductPrimaryImage(product.image_url) || '/hero_image.jpg',
        });
      }
    }

    return { items: normalizedItems, expired: false };
  } catch (error) {
    console.warn('Error fetching user cart items:', error);
    return { items: [], expired: false };
  }
}

/**
 * Gets or creates a cart record for the user, refreshing updated_at timestamp.
 */
export async function getOrCreateCart(userId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();

  try {
    const { data: existingCart } = await supabase
      .from('carts')
      .select('id, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existingCart) {
      // If expired, delete existing items first to start fresh
      if (isCartExpired(existingCart.updated_at)) {
        await supabase.from('cart_items').delete().eq('cart_id', existingCart.id);
      }

      // Refresh activity timestamp
      await supabase
        .from('carts')
        .update({ updated_at: now })
        .eq('id', existingCart.id);

      return existingCart.id;
    }

    // Create new cart
    const { data: newCart, error: createError } = await supabase
      .from('carts')
      .insert({
        user_id: userId,
        updated_at: now,
      })
      .select('id')
      .single();

    if (createError || !newCart) {
      return null;
    }

    return newCart.id;
  } catch (err) {
    console.warn('Error in getOrCreateCart:', err);
    return null;
  }
}

/**
 * Adds a product to the user's cart in Supabase. Refreshes the 7-day expiration window.
 */
export async function addProductToCart(userId: string, productId: string) {
  if (!productId || typeof productId !== 'string' || !productId.trim()) {
    return false;
  }
  const cleanProductId = productId.trim();
  const supabase = createSupabaseAdminClient();

  // 1. Confirm product exists and is Published before adding to cart
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('id, status')
    .eq('id', cleanProductId)
    .single();

  if (prodErr || !product || product.status !== 'Published') {
    console.warn(`Cannot add product ${cleanProductId} to cart: not found or not published.`);
    return false;
  }

  const cartId = await getOrCreateCart(userId);
  if (!cartId) {
    console.error(`Failed to get or create cart for user: ${userId}`);
    return false;
  }

  try {
    // Insert if not already in cart (unique constraint prevents duplicate entries)
    const { error: upsertError } = await supabase.from('cart_items').upsert(
      {
        cart_id: cartId,
        product_id: cleanProductId,
      },
      { onConflict: 'cart_id,product_id' }
    );

    if (upsertError) {
      console.error(`Database error adding product ${productId} to cart ${cartId}:`, upsertError);
      return false;
    }

    // Refresh cart updated_at
    const { error: updateError } = await supabase
      .from('carts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cartId);

    if (updateError) {
      console.warn(`Failed to update cart timestamp for ${cartId}:`, updateError);
    }

    return true;
  } catch (err) {
    console.error(`Unexpected exception adding product ${productId} to cart:`, err);
    return false;
  }
}

/**
 * Removes a product from the user's cart. Refreshes the 7-day expiration window.
 */
export async function removeProductFromCart(userId: string, productId: string) {
  const supabase = createSupabaseAdminClient();

  try {
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (cartError) {
      console.error(`Database error fetching cart for user ${userId}:`, cartError);
      return false;
    }

    if (!cart) return false;

    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id)
      .eq('product_id', productId);

    if (deleteError) {
      console.error(`Database error removing product ${productId} from cart ${cart.id}:`, deleteError);
      return false;
    }

    // Refresh activity timestamp
    await supabase
      .from('carts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', cart.id);

    return true;
  } catch (err) {
    console.error(`Unexpected exception removing product ${productId} from cart:`, err);
    return false;
  }
}

/**
 * Clears all items from the user's active cart.
 * Idempotent. Does NOT affect orders, order items, or customer history.
 */
export async function clearUserCart(userId: string) {
  const supabase = createSupabaseAdminClient();

  try {
    const cartsQuery = supabase?.from ? supabase.from('carts') : null;
    if (!cartsQuery || typeof cartsQuery.select !== 'function') {
      return true;
    }

    const { data: cart, error: cartError } = await cartsQuery
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (cartError) {
      console.error(`Database error fetching cart for clearUserCart (${userId}):`, cartError);
      return false;
    }

    if (!cart) return true;

    // Delete cart items and cart
    const { error: itemsError } = await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    if (itemsError) {
      console.error(`Database error deleting cart items for cart ${cart.id}:`, itemsError);
      return false;
    }

    const { error: deleteError } = await supabase.from('carts').delete().eq('id', cart.id);
    if (deleteError) {
      console.error(`Database error deleting cart ${cart.id}:`, deleteError);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`Unexpected exception clearing cart for user ${userId}:`, err);
    return false;
  }
}

/**
 * Merges anonymous local storage items into the user's database cart without duplicates.
 * Validates product IDs, confirms products are Published, enforces reasonable limits,
 * and handles database errors explicitly.
 */
export async function mergeAnonymousCartIntoUser(userId: string, localProductIds: string[]) {
  if (!localProductIds || localProductIds.length === 0) {
    return getUserCartItems(userId);
  }

  // 1. Sanitize and enforce limits on incoming product IDs (max 50 unique items)
  const uniqueProductIds = Array.from(
    new Set(
      localProductIds
        .filter((id) => typeof id === 'string' && id.trim().length > 0)
        .map((id) => id.trim())
    )
  ).slice(0, 50);

  if (uniqueProductIds.length === 0) {
    return getUserCartItems(userId);
  }

  const supabase = createSupabaseAdminClient();

  // 2. Confirm products exist and are Published before merging
  const { data: publishedProducts, error: prodError } = await supabase
    .from('products')
    .select('id, status')
    .in('id', uniqueProductIds);

  if (prodError) {
    console.error('Database error verifying products for cart merge:', prodError);
    throw new Error(`Failed to verify products for cart merge: ${prodError.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validPublishedIds = (publishedProducts || [])
    .filter((p: any) => p.status === 'Published')
    .map((p: any) => p.id);

  if (validPublishedIds.length === 0) {
    return getUserCartItems(userId);
  }

  // 3. Get or create active cart for user
  const cartId = await getOrCreateCart(userId);
  if (!cartId) {
    throw new Error('Failed to create or retrieve cart for user');
  }

  // 4. Upsert valid items into cart_items, checking for database errors
  const rows = validPublishedIds.map((pid) => ({
    cart_id: cartId,
    product_id: pid,
  }));

  const { error: upsertError } = await supabase
    .from('cart_items')
    .upsert(rows, { onConflict: 'cart_id,product_id' });

  if (upsertError) {
    console.error(`Database error during cart merge upsert for cart ${cartId}:`, upsertError);
    throw new Error(`Database error merging items into cart: ${upsertError.message}`);
  }

  // 5. Refresh cart activity timestamp consistently
  const { error: updateError } = await supabase
    .from('carts')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', cartId);

  if (updateError) {
    console.warn(`Failed to refresh cart timestamp on merge for cart ${cartId}:`, updateError);
  }

  return getUserCartItems(userId);
}

/**
 * Scheduled cleanup routine that removes carts inactive for > 7 days.
 * Safe and idempotent.
 */
export async function cleanupExpiredCarts(): Promise<number> {
  const supabase = createSupabaseAdminClient();

  try {
    const cutoff = new Date(Date.now() - CART_EXPIRATION_MS).toISOString();

    // Find carts older than cutoff
    const { data: expiredCarts, error: findError } = await supabase
      .from('carts')
      .select('id')
      .lt('updated_at', cutoff);

    if (findError || !expiredCarts || expiredCarts.length === 0) {
      return 0;
    }

    const ids = expiredCarts.map((c) => c.id);

    // Delete expired carts (cascade deletes cart_items)
    const { error: deleteError } = await supabase.from('carts').delete().in('id', ids);

    if (deleteError) {
      console.warn('Error cleaning up carts:', deleteError);
      return 0;
    }

    return ids.length;
  } catch (err) {
    console.warn('Error running cleanupExpiredCarts:', err);
    return 0;
  }
}
