import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Package, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import OptimizedImage from '@/components/products/OptimizedImage';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { products as catalogProducts } from '@/data/products';
import { useToast } from '@/hooks/use-toast';
import type { OrderStatus } from '@/lib/database.types';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

interface DbOrder {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  currency: string;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string | null;
  shipping_address: string;
  shipping_city: string;
  shipping_pincode: string;
  notes: string | null;
  payment_gateway: string;
  payment_status: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  payment_currency: string;
  created_at: string;
  updated_at: string;
}

interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  selected_size: string;
  selected_color: string;
  created_at: string;
}

interface OrderWithItems extends DbOrder {
  items: DbOrderItem[];
}

interface DisplayOrderItem {
  key: string;
  productName: string;
  quantity: number;
  productId?: string;
}

const statusLabelMap: Record<OrderStatus, string> = {
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const statusBadgeClassMap: Record<OrderStatus, string> = {
  processing: 'bg-blue-100 text-blue-700 border-transparent dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  shipped: 'bg-amber-100 text-amber-700 border-transparent dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  out_for_delivery: 'bg-orange-100 text-orange-700 border-transparent dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  delivered: 'bg-emerald-100 text-emerald-700 border-transparent dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  cancelled: 'bg-red-100 text-red-700 border-transparent dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
};

const formatAmount = (amount: number, currency: string) => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(safeAmount);
  }
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const toSecureImageUrl = (value: string) => value.replace(/^http:\/\//i, 'https://');

const toMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const maybeTimestamp = value as { toMillis?: () => number };
  if (typeof maybeTimestamp.toMillis === 'function') {
    return maybeTimestamp.toMillis();
  }

  return 0;
};

const extractItemsFromNotes = (notes: string | null): Array<{ productName: string; quantity: number }> => {
  if (!notes) return [];

  const match = notes.match(/items:\s*(.+)$/i);
  if (!match || !match[1]) return [];

  return match[1]
    .split(',')
    .map((rawItem) => rawItem.trim())
    .filter(Boolean)
    .map((rawItem) => {
      const quantityMatch = rawItem.match(/^(.*)\s+x(\d+)$/i);

      if (!quantityMatch) {
        return {
          productName: rawItem,
          quantity: 1,
        };
      }

      return {
        productName: quantityMatch[1].trim(),
        quantity: Number(quantityMatch[2] || 1),
      };
    });
};

const OrderHistory: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const productImageById = useMemo(
    () => new Map(catalogProducts.map((product) => [product.id, toSecureImageUrl(product.image)])),
    [],
  );

  const productImageByName = useMemo(
    () => new Map(catalogProducts.map((product) => [normalizeText(product.name), toSecureImageUrl(product.image)])),
    [],
  );

  const productImageEntries = useMemo(
    () =>
      catalogProducts.map((product) => ({
        normalizedName: normalizeText(product.name),
        image: toSecureImageUrl(product.image),
      })),
    [],
  );

  const getItemImage = (productId: string | undefined, productName: string) => {
    if (productId) {
      const byId = productImageById.get(productId.trim());
      if (byId) return byId;
    }

    const normalizedProductName = normalizeText(productName);
    const byName = productImageByName.get(normalizedProductName);
    if (byName) return byName;

    const byPartialName = productImageEntries.find(
      (entry) =>
        entry.normalizedName.includes(normalizedProductName) ||
        normalizedProductName.includes(entry.normalizedName),
    );

    return byPartialName?.image || null;
  };

  const getDisplayItems = (order: OrderWithItems): DisplayOrderItem[] => {
    if (order.items.length > 0) {
      return order.items.map((item) => ({
        key: item.id,
        productName: item.product_name,
        quantity: item.quantity,
        productId: item.product_id,
      }));
    }

    const notesItems = extractItemsFromNotes(order.notes);
    return notesItems.map((item, index) => ({
      key: `${order.id}-notes-${index}`,
      productName: item.productName,
      quantity: item.quantity,
    }));
  };

  useEffect(() => {
    if (!user?.id) return;

    let isCancelled = false;

    const fetchOrders = async () => {
      setIsLoading(true);

      try {
        const firestore = getFirestore();
        const ordersSnapshot = await getDocs(collection(firestore, 'orders'));
        const rawOrders: Array<Record<string, unknown> & { id: string }> = ordersSnapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...(snapshotDoc.data() as Record<string, unknown>),
        }));

        const normalizedOrders = rawOrders
          .filter((order) => {
            const ownerId = String(order.user_id || order.userId || '');
            return ownerId === user.id;
          })
          .map((order) => ({
            ...order,
            user_id: String(order.user_id || order.userId || user.id),
            status: (order.status as OrderStatus) || 'processing',
            total_amount: Number(order.total_amount ?? order.totalAmount ?? 0),
            currency: String(order.currency || 'INR'),
            shipping_name: String(order.shipping_name || order.shippingName || ''),
            shipping_email: String(order.shipping_email || order.shippingEmail || ''),
            shipping_phone: (order.shipping_phone || order.shippingPhone || null) as string | null,
            shipping_address: String(order.shipping_address || order.shippingAddress || ''),
            shipping_city: String(order.shipping_city || order.shippingCity || ''),
            shipping_pincode: String(order.shipping_pincode || order.shippingPincode || ''),
            notes: (order.notes || null) as string | null,
            payment_gateway: String(order.payment_gateway || order.paymentGateway || 'stripe'),
            payment_status: String(order.payment_status || order.paymentStatus || 'paid') as DbOrder['payment_status'],
            stripe_checkout_session_id: (order.stripe_checkout_session_id || order.stripeCheckoutSessionId || null) as string | null,
            stripe_payment_intent_id: (order.stripe_payment_intent_id || order.stripePaymentIntentId || null) as string | null,
            paid_at: order.paid_at || order.paidAt ? new Date(toMillis(order.paid_at || order.paidAt)).toISOString() : null,
            payment_currency: String(order.payment_currency || order.paymentCurrency || order.currency || 'INR'),
            created_at: new Date(toMillis(order.created_at || order.createdAt) || Date.now()).toISOString(),
            updated_at: new Date(toMillis(order.updated_at || order.updatedAt || order.created_at || order.createdAt) || Date.now()).toISOString(),
          }))
          .sort((firstOrder, secondOrder) => toMillis(secondOrder.created_at) - toMillis(firstOrder.created_at));

        const orderIds = new Set(normalizedOrders.map((order) => order.id));
        const itemsByOrder: Record<string, DbOrderItem[]> = {};

        if (orderIds.size > 0) {
          const itemsSnapshot = await getDocs(collection(firestore, 'orderItems'));

          itemsSnapshot.forEach((snapshotDoc) => {
            const itemData = snapshotDoc.data() as Record<string, unknown>;
            const orderId = String(itemData.order_id || itemData.orderId || '');

            if (!orderId || !orderIds.has(orderId)) return;

            const normalizedItem: DbOrderItem = {
              id: snapshotDoc.id,
              order_id: orderId,
              product_id: String(itemData.product_id || itemData.productId || ''),
              product_name: String(itemData.product_name || itemData.productName || 'Item'),
              unit_price: Number(itemData.unit_price ?? itemData.unitPrice ?? itemData.price ?? 0),
              quantity: Number(itemData.quantity ?? 1),
              selected_size: String(itemData.selected_size || itemData.selectedSize || ''),
              selected_color: String(itemData.selected_color || itemData.selectedColor || ''),
              created_at: new Date(toMillis(itemData['created_at'] || itemData['createdAt']) || Date.now()).toISOString(),
            };

            if (!itemsByOrder[orderId]) {
              itemsByOrder[orderId] = [];
            }

            itemsByOrder[orderId].push(normalizedItem);
          });
        }

        const nextOrders: OrderWithItems[] = normalizedOrders.map((order) => ({
          ...(order as DbOrder),
          items: itemsByOrder[order.id] || [],
        }));

        if (!isCancelled) {
          setOrders(nextOrders);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load orders right now.';
        if (!isCancelled) {
          toast({ title: message, variant: 'destructive' });
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchOrders();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        <Button variant="ghost" asChild className="mb-4 px-0">
          <Link to="/" className="inline-flex items-center gap-2">
            <ArrowLeft size={16} /> Continue shopping
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold">Order History</h1>
          <p className="text-muted-foreground mt-1">View all your orders and open tracking details.</p>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">No orders yet</CardTitle>
              <CardDescription>Place your first order and it will appear here.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="pink" asChild>
                <Link to="/categories">Browse Products</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const displayItems = getDisplayItems(order);

              return (
              <Card key={order.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
                      <CardDescription className="mt-1 inline-flex items-center gap-1.5">
                        <Clock size={14} /> Placed on {formatDate(order.created_at)}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className={statusBadgeClassMap[order.status]}>
                      {statusLabelMap[order.status]}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-2">
                      <p className="text-sm font-medium">Items</p>
                      {displayItems.length > 0 ? (
                        <div className="space-y-1">
                          {displayItems.slice(0, 4).map((item) => {
                            const itemImage = getItemImage(item.productId, item.productName);

                            return (
                              <div key={item.key} className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-md bg-secondary overflow-hidden flex-shrink-0 relative">
                                  {itemImage ? (
                                    <OptimizedImage
                                      src={itemImage}
                                      alt={item.productName}
                                      className="w-full h-full object-cover"
                                      fallbackText={item.productName}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground font-medium uppercase">
                                      {item.productName.slice(0, 1) || 'P'}
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {item.productName} × {item.quantity}
                                </p>
                              </div>
                            );
                          })}
                          {displayItems.length > 4 && (
                            <p className="text-sm text-muted-foreground">+{displayItems.length - 4} more items</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Item details are not available for this order. Order ID: #{order.id.slice(0, 8)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Shipping</p>
                      <p className="text-sm text-muted-foreground inline-flex items-start gap-1.5">
                        <MapPin size={14} className="mt-0.5" />
                        <span>
                          {order.shipping_city}, {order.shipping_pincode}
                        </span>
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Amount</p>
                      <p className="text-lg font-semibold">
                        {formatAmount(Number(order.total_amount || 0), order.currency || 'INR')}
                      </p>
                    </div>

                    <Button variant="outline" asChild>
                      <Link to={`/track-order?orderId=${encodeURIComponent(order.id)}`} className="inline-flex items-center gap-2">
                        <Package size={16} /> Track Order
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default OrderHistory;
