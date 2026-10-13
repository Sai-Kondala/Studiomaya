/**
 * Unit test for RLS ownership policy logic for `orders` and `order_items`.
 *
 * Evaluates the policy predicates:
 * Orders:
 *   (orders.user_id IS NOT NULL AND orders.user_id = auth.uid())
 *   OR
 *   (orders.user_id IS NULL AND orders.customer_email = auth.email)
 *
 * Order Items:
 *   EXISTS (parent order satisfying the above predicate)
 */

interface OrderRow {
  id: string;
  user_id: string | null;
  customer_email: string | null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
}

interface AuthContext {
  uid: string;
  email: string;
}

function evaluateOrdersSelectPolicy(order: OrderRow, auth: AuthContext): boolean {
  const isAssignedToUser = order.user_id !== null && order.user_id === auth.uid;
  const isUnassignedGuestMatchingEmail =
    order.user_id === null &&
    order.customer_email !== null &&
    order.customer_email.trim().toLowerCase() === auth.email.trim().toLowerCase();

  return isAssignedToUser || isUnassignedGuestMatchingEmail;
}

function evaluateOrderItemsSelectPolicy(
  item: OrderItemRow,
  orders: OrderRow[],
  auth: AuthContext
): boolean {
  const parentOrder = orders.find((o) => o.id === item.order_id);
  if (!parentOrder) return false;
  return evaluateOrdersSelectPolicy(parentOrder, auth);
}

describe('Supabase RLS Orders & Order Items Policy Specification', () => {
  const authUser: AuthContext = {
    uid: 'user_alice',
    email: 'alice@example.com',
  };

  const sampleOrders: OrderRow[] = [
    {
      id: 'ord_1',
      user_id: 'user_alice',
      customer_email: 'alice@example.com',
    },
    {
      id: 'ord_2',
      user_id: 'user_alice',
      customer_email: 'different_email@example.com', // Assigned to Alice, but bought with different email
    },
    {
      id: 'ord_3',
      user_id: 'user_bob', // Assigned to Bob
      customer_email: 'alice@example.com', // Email matches Alice!
    },
    {
      id: 'ord_4',
      user_id: null, // Unassigned guest order
      customer_email: 'alice@example.com', // Email matches Alice
    },
    {
      id: 'ord_5',
      user_id: null, // Unassigned guest order
      customer_email: 'charlie@example.com', // Different email
    },
  ];

  const sampleItems: OrderItemRow[] = [
    { id: 'item_1', order_id: 'ord_1', product_id: 'p_1' },
    { id: 'item_2', order_id: 'ord_2', product_id: 'p_2' },
    { id: 'item_3', order_id: 'ord_3', product_id: 'p_3' },
    { id: 'item_4', order_id: 'ord_4', product_id: 'p_4' },
    { id: 'item_5', order_id: 'ord_5', product_id: 'p_5' },
  ];

  it('allows user to read orders assigned to their own user_id', () => {
    expect(evaluateOrdersSelectPolicy(sampleOrders[0], authUser)).toBe(true);
    expect(evaluateOrdersSelectPolicy(sampleOrders[1], authUser)).toBe(true);
  });

  it('strictly forbids reading orders assigned to another user even if customer_email matches', () => {
    // SECURITY CRITICAL: ord_3 is assigned to Bob, so Alice MUST NOT be able to read it
    expect(evaluateOrdersSelectPolicy(sampleOrders[2], authUser)).toBe(false);
  });

  it('allows email matching only for unassigned guest orders (user_id IS NULL)', () => {
    expect(evaluateOrdersSelectPolicy(sampleOrders[3], authUser)).toBe(true);
  });

  it('forbids reading unassigned guest orders with a different email', () => {
    expect(evaluateOrdersSelectPolicy(sampleOrders[4], authUser)).toBe(false);
  });

  it('enforces the same ownership rules for order_items', () => {
    // Can read items for own orders
    expect(evaluateOrderItemsSelectPolicy(sampleItems[0], sampleOrders, authUser)).toBe(true);
    expect(evaluateOrderItemsSelectPolicy(sampleItems[1], sampleOrders, authUser)).toBe(true);

    // CANNOT read items for order assigned to another user
    expect(evaluateOrderItemsSelectPolicy(sampleItems[2], sampleOrders, authUser)).toBe(false);

    // Can read items for unassigned matching guest order
    expect(evaluateOrderItemsSelectPolicy(sampleItems[3], sampleOrders, authUser)).toBe(true);

    // CANNOT read items for unassigned other guest order
    expect(evaluateOrderItemsSelectPolicy(sampleItems[4], sampleOrders, authUser)).toBe(false);
  });
});
