import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Easing } from 'framer-motion';
import * as XLSX from 'xlsx';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ShieldCheck, Package, Users, ShoppingCart, DollarSign,
  TrendingUp, TrendingDown, ArrowUpRight, Star, LayoutDashboard,
  Plus, Pencil, Trash2, X, Search, Eye, Truck, CheckCircle2,
  XCircle, Clock, Tag, ChevronDown, MapPin, Download,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
const isFirebaseConfigured = true; // Firebase always configured when on this page
import { useToast } from '@/hooks/use-toast';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import type { OrderStatus, AppRole } from '@/lib/database.types';
import type { Product as CatalogProduct } from '@/data/products';
import { products as localCatalogProducts } from '@/data/products';

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'products' | 'customers' | 'orders';
type RecommendationType = 'for_you' | 'wishlist_inspired' | 'similar_products' | 'trending';
type OverviewGraphMode = 'top_products' | 'recent_orders' | 'revenue';

interface AdminProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  category: string;
  subCategory: string;
  image: string;
  stock: number;
  rating: number;
}

interface Order {
  id: string;
  displayId: string;
  customer: string;
  email: string;
  amount: number;
  status: OrderStatus;
  date: string;
  createdAtMs: number;
  items: number;
  address: string;
  product: string;
}

interface TopProduct {
  id: string;
  name: string;
  brand: string;
  image: string;
  rating: number;
  quantitySold: number;
  revenue: number;
}

interface AdminCustomer {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  gender: string;
  role: AppRole;
  joinedAt: string;
  address: string;
  city: string;
  pincode: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomerForm {
  fullName: string;
  phone: string;
  gender: string;
  role: AppRole;
  address: string;
  city: string;
  pincode: string;
}

interface DashboardMetrics {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  processingOrders: number;
  shippedOrders: number;
  outForDeliveryOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
}

interface RecommendationTrendPoint {
  day: string;
  for_you: number;
  wishlist_inspired: number;
  similar_products: number;
  trending: number;
  total: number;
}

interface RecommendationModelBreakdownPoint {
  modelVersion: string;
  records: number;
  averageScore: number;
  source: 'reported' | 'inferred';
}

// ─── Constants ───────────────────────────────────────────────────────────────
const BASE_CATEGORIES = ['Apparel', 'Accessories', 'Footwear', 'Personal Care'];

const STATUS_FLOW: OrderStatus[] = ['processing', 'shipped', 'out_for_delivery', 'delivered'];

const STATUS_COLORS: Record<OrderStatus, string> = {
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  shipped: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  out_for_delivery: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const TRACK_STEPS: { status: OrderStatus; Icon: LucideIcon }[] = [
  { status: 'processing', Icon: Clock },
  { status: 'shipped', Icon: Package },
  { status: 'out_for_delivery', Icon: Truck },
  { status: 'delivered', Icon: CheckCircle2 },
];

const RECOMMENDATION_TYPES: RecommendationType[] = [
  'for_you',
  'wishlist_inspired',
  'similar_products',
  'trending',
];

const RECOMMENDATION_LABELS: Record<RecommendationType, string> = {
  for_you: 'For You',
  wishlist_inspired: 'Wishlist Inspired',
  similar_products: 'Similar Products',
  trending: 'Trending',
};

const RECOMMENDATION_TREND_CONFIG = {
  for_you: {
    label: RECOMMENDATION_LABELS.for_you,
    color: '#2563eb',
  },
  wishlist_inspired: {
    label: RECOMMENDATION_LABELS.wishlist_inspired,
    color: '#db2777',
  },
  similar_products: {
    label: RECOMMENDATION_LABELS.similar_products,
    color: '#f59e0b',
  },
  trending: {
    label: RECOMMENDATION_LABELS.trending,
    color: '#10b981',
  },
} satisfies ChartConfig;

const RECOMMENDATION_TREND_COLORS: Record<RecommendationType, string> = {
  for_you: '#2563eb',
  wishlist_inspired: '#db2777',
  similar_products: '#f59e0b',
  trending: '#10b981',
};

const RECOMMENDATION_MODEL_CONFIG = {
  records: {
    label: 'Recommendation Rows',
    color: '#7c3aed',
  },
} satisfies ChartConfig;

const OVERVIEW_GRAPH_CONFIG = {
  value: {
    label: 'Value',
    color: '#0ea5e9',
  },
} satisfies ChartConfig;

const EMPTY_FORM: Omit<AdminProduct, 'id' | 'rating'> = {
  name: '',
  brand: '',
  price: 0,
  originalPrice: undefined,
  category: 'Apparel',
  subCategory: '',
  image: '',
  stock: 0,
};

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: 'easeOut' as Easing },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDateValue = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object') {
    const candidate = value as {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
      nanoseconds?: number;
    };

    if (typeof candidate.toDate === 'function') {
      const parsed = candidate.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof candidate.toMillis === 'function') {
      const parsed = new Date(candidate.toMillis());
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof candidate.seconds === 'number') {
      const parsed = new Date(candidate.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
};

const toOrderStatus = (value: unknown): OrderStatus => {
  const normalized = toText(value).toLowerCase();

  if (
    normalized === 'processing'
    || normalized === 'shipped'
    || normalized === 'out_for_delivery'
    || normalized === 'delivered'
    || normalized === 'cancelled'
  ) {
    return normalized;
  }

  return 'processing';
};

const isRecommendationType = (value: string): value is RecommendationType =>
  RECOMMENDATION_TYPES.includes(value as RecommendationType);

const INFERRED_MODEL_BY_TYPE: Record<RecommendationType, string> = {
  for_you: 'behavioral-v1',
  wishlist_inspired: 'wishlist-v1',
  similar_products: 'similarity-v1',
  trending: 'trending-v1',
};

const normalizeModelVersion = (value: unknown) => {
  const normalized = toText(value).trim();
  if (!normalized) return '';

  const lower = normalized.toLowerCase();
  if (
    lower === 'unknown'
    || lower === 'n/a'
    || lower === 'na'
    || lower === 'null'
    || lower === 'undefined'
    || lower === '-'
  ) {
    return '';
  }

  return normalized;
};

const resolveModelVersion = (row: Record<string, unknown>, recommendationType: RecommendationType) => {
  const metadata =
    row['eventMetadata'] && typeof row['eventMetadata'] === 'object'
      ? (row['eventMetadata'] as Record<string, unknown>)
      : row['metadata'] && typeof row['metadata'] === 'object'
        ? (row['metadata'] as Record<string, unknown>)
        : null;

  const explicitModelVersion = normalizeModelVersion(
    row['model_version']
    || row['modelVersion']
    || row['model']
    || row['engine_version']
    || row['engineVersion']
    || metadata?.['model_version']
    || metadata?.['modelVersion']
    || metadata?.['model']
    || metadata?.['engineVersion'],
  );

  if (explicitModelVersion) {
    return {
      modelVersion: explicitModelVersion,
      source: 'reported' as const,
    };
  }

  return {
    modelVersion: INFERRED_MODEL_BY_TYPE[recommendationType],
    source: 'inferred' as const,
  };
};

const compactModelLabel = (value: string) => (value.length > 14 ? `${value.slice(0, 13)}...` : value);

const getOverviewGraphTheme = (mode: OverviewGraphMode) => {
  if (mode === 'top_products') {
    return {
      stroke: '#0ea5e9',
      gradientStart: '#38bdf8',
      gradientEnd: '#2563eb',
      panel: 'from-sky-50/80 via-cyan-50/40 to-transparent',
    };
  }

  if (mode === 'recent_orders') {
    return {
      stroke: '#ec4899',
      gradientStart: '#f472b6',
      gradientEnd: '#db2777',
      panel: 'from-rose-50/80 via-pink-50/40 to-transparent',
    };
  }

  return {
    stroke: '#10b981',
    gradientStart: '#34d399',
    gradientEnd: '#059669',
    panel: 'from-emerald-50/80 via-green-50/40 to-transparent',
  };
};

const toRecommendationType = (row: Record<string, unknown>): RecommendationType => {
  const rawType = toText(
    row['recommendation_type'] || row['recommendationType'] || row['type'] || row['eventType'] || row['event_type'],
  ).toLowerCase();

  if (isRecommendationType(rawType)) {
    return rawType;
  }

  if (rawType === 'visual_similar') {
    return 'similar_products';
  }

  if (rawType === 'add_to_wishlist' || rawType === 'wishlist') {
    return 'wishlist_inspired';
  }

  if (rawType === 'view_product' || rawType === 'add_to_cart' || rawType === 'cart') {
    return 'for_you';
  }

  return 'trending';
};

const isMissingRecommendationTableError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  const code = toText(candidate.code).toUpperCase();
  const message = toText(candidate.message).toLowerCase();
  const details = toText(candidate.details).toLowerCase();
  const hint = toText(candidate.hint).toLowerCase();
  const combined = `${message} ${details} ${hint}`;

  return (
    code === 'PGRST205'
    || code === '42P01'
    || combined.includes("could not find the table 'public.user_recommendations'")
    || combined.includes('relation "public.user_recommendations" does not exist')
    || combined.includes('user_recommendations')
  );
};

const formatOrderDate = (value: unknown) => {
  const date = toDateValue(value);
  if (!date) return '—';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatOrderCode = (id: string) => {
  const compact = id.replace(/-/g, '').toUpperCase();
  if (!compact) return '#ORD-—';
  return `#ORD-${compact.slice(0, 8)}`;
};

const normalizeCategorySlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_') || 'general';

const resolveDefaultImage = () => 'https://placehold.co/600x800/f3f4f6/a3a3a3?text=Product';

const mapProductRow = (row: Record<string, unknown>): AdminProduct => ({
  id: toText(row.id),
  name: toText(row.name, 'Untitled Product'),
  brand: toText(row.brand, 'Unknown Brand'),
  price: toNumber(row.price),
  originalPrice:
    row.original_price == null && row.originalPrice == null
      ? undefined
      : toNumber(row.original_price ?? row.originalPrice),
  category: toText(row.master_category || row.masterCategory || row.category, 'Apparel'),
  subCategory: toText(row.sub_category || row.subCategory, 'General'),
  image: toText(row.image_url || row.imageUrl || row.image, resolveDefaultImage()),
  stock: Math.max(0, Math.floor(toNumber(row.stock))),
  rating: Number(toNumber(row.rating).toFixed(2)),
});

const mapCatalogProduct = (product: CatalogProduct): AdminProduct => ({
  id: toText(product.id),
  name: toText(product.name, 'Untitled Product'),
  brand: toText(product.brand, 'Unknown Brand'),
  price: toNumber(product.price),
  originalPrice: product.originalPrice == null ? undefined : toNumber(product.originalPrice),
  category: toText(product.masterCategory, 'Apparel'),
  subCategory: toText(product.subCategory, 'General'),
  image: toText(product.image, resolveDefaultImage()),
  stock: 0,
  rating: Number(toNumber(product.rating).toFixed(2)),
});

const mapOrderRow = (row: Record<string, unknown>): Order => {
  const rawId = toText(row.id);
  const city = toText(row.city || row.shipping_city || row.shippingCity);
  const pincode = toText(row.pincode || row.shipping_pincode || row.shippingPincode);
  const addressParts = [toText(row.address || row.shipping_address || row.shippingAddress), city, pincode].filter(Boolean);
  const statusRaw = row.status;
  const createdAtRaw = row.created_at || row.createdAt;
  const createdAtDate = toDateValue(createdAtRaw);

  return {
    id: rawId,
    displayId: formatOrderCode(rawId),
    customer: toText(row.customer || row.shipping_name || row.shippingName, 'Unknown Customer'),
    email: toText(row.email || row.shipping_email || row.shippingEmail, '—'),
    amount: toNumber(row.amount ?? row.total_amount ?? row.totalAmount),
    status: toOrderStatus(statusRaw),
    date: formatOrderDate(createdAtRaw),
    createdAtMs: createdAtDate ? createdAtDate.getTime() : 0,
    items: Math.max(0, Math.floor(toNumber(row.items ?? row.item_count ?? row.itemCount))),
    address: addressParts.join(', ') || 'Address unavailable',
    product: toText(row.product || row.first_product_name || row.firstProductName, '—'),
  };
};

const mapTopProductRow = (row: Record<string, unknown>): TopProduct => ({
  id: toText(row.product_id || row.productId),
  name: toText(row.name, 'Untitled Product'),
  brand: toText(row.brand, 'Unknown Brand'),
  image: toText(row.image_url || row.imageUrl || row.image, resolveDefaultImage()),
  rating: Number(toNumber(row.rating).toFixed(2)),
  quantitySold: Math.max(0, Math.floor(toNumber(row.quantity_sold ?? row.quantitySold))),
  revenue: toNumber(row.revenue),
});

const mapCustomerRow = (row: Record<string, unknown>): AdminCustomer => ({
  id: toText(row.id),
  email: toText(row.email, '—'),
  fullName: toText(row.full_name || row.fullName, 'Unnamed Customer'),
  phone: toText(row.phone, '—'),
  gender: toText(row.gender, '—'),
  role: toText(row.role, 'customer') === 'admin' ? 'admin' : 'customer',
  joinedAt: formatOrderDate(row.joined_at || row.joinedAt || row.created_at || row.createdAt),
  address: toText(row.address, ''),
  city: toText(row.city, ''),
  pincode: toText(row.pincode, ''),
  createdAt: toText(row.created_at || row.createdAt),
  updatedAt: toText(row.updated_at || row.updatedAt),
});

const EMPTY_CUSTOMER_FORM: CustomerForm = {
  fullName: '',
  phone: '',
  gender: '',
  role: 'customer',
  address: '',
  city: '',
  pincode: '',
};

// ─── Component ───────────────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('overview');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [appointingAdminId, setAppointingAdminId] = useState<string | null>(null);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);
  const [isProductsBackgroundSyncing, setIsProductsBackgroundSyncing] = useState(false);
  const [hasLoadedProducts, setHasLoadedProducts] = useState(false);
  const [hasLoadedCustomers, setHasLoadedCustomers] = useState(false);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recommendationTrendData, setRecommendationTrendData] = useState<RecommendationTrendPoint[]>([]);
  const [recommendationModelData, setRecommendationModelData] = useState<RecommendationModelBreakdownPoint[]>([]);
  const [isRecommendationAnalyticsAvailable, setIsRecommendationAnalyticsAvailable] = useState(true);
  const [overviewGraphMode, setOverviewGraphMode] = useState<OverviewGraphMode>('top_products');
  const [showAllTopProducts, setShowAllTopProducts] = useState(false);
  const [showOverviewGraphs, setShowOverviewGraphs] = useState(true);

  // ── Products state ────────────────────────────────────────────────────────
  const [adminProducts, setAdminProducts] = useState<AdminProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('All');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [productForm, setProductForm] = useState<Omit<AdminProduct, 'id' | 'rating'>>({ ...EMPTY_FORM });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // ── Orders state ──────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  // ── Customers state ───────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerRoleFilter, setCustomerRoleFilter] = useState<AppRole | 'All'>('All');
  const [editingCustomer, setEditingCustomer] = useState<AdminCustomer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerForm>({ ...EMPTY_CUSTOMER_FORM });

  const hydrateProducts = useCallback(async () => {
    setIsProductsLoading(true);
    setIsProductsBackgroundSyncing(false);

    try {
      const firestore = getFirestore();
      const snapshot = await getDocs(collection(firestore, 'products'));

      const productsById = new Map<string, AdminProduct>();

      // 1. Base initialization from massive local JSON dataset
      for (const localProduct of localCatalogProducts) {
        productsById.set(localProduct.id, mapCatalogProduct(localProduct));
      }

      // 2. Override with any manual changes saved to Firestore
      for (const productDoc of snapshot.docs) {
        const mappedProduct = mapProductRow({
          id: productDoc.id,
          ...(productDoc.data() as Record<string, unknown>),
        });
        productsById.set(mappedProduct.id, mappedProduct);
      }

      const mappedProducts = Array.from(productsById.values());
      mappedProducts.sort((firstProduct, secondProduct) => firstProduct.name.localeCompare(secondProduct.name));

      setAdminProducts(mappedProducts);
      setHasLoadedProducts(true);
    } catch (error) {
      const fallbackProducts = localCatalogProducts
        .map(mapCatalogProduct)
        .sort((firstProduct, secondProduct) => firstProduct.name.localeCompare(secondProduct.name));

      setAdminProducts(fallbackProducts);
      setHasLoadedProducts(true);

      const message = error instanceof Error
        ? `Unable to load Firestore products (${error.message}). Showing local catalog instead.`
        : 'Unable to load Firestore products. Showing local catalog instead.';

      toast({
        title: message,
        variant: 'destructive',
      });
    } finally {
      setIsProductsLoading(false);
      setIsProductsBackgroundSyncing(false);
    }
  }, [toast]);

  const hydrateOrders = useCallback(async () => {
    const firestore = getFirestore();
    const [ordersSnapshot, orderItemsSnapshot] = await Promise.all([
      getDocs(collection(firestore, 'orders')),
      getDocs(collection(firestore, 'orderItems')),
    ]);

    const orderItemStats = new Map<string, { itemCount: number; firstProductName: string }>();

    for (const snapshotDoc of orderItemsSnapshot.docs) {
      const data = snapshotDoc.data() as Record<string, unknown>;
      const orderId = toText(data.order_id || data.orderId);

      if (!orderId) continue;

      const quantity = Math.max(1, Math.floor(toNumber(data.quantity, 1)));
      const productName = toText(data.product_name || data.productName, '—');
      const existing = orderItemStats.get(orderId) || { itemCount: 0, firstProductName: '—' };

      existing.itemCount += quantity;
      if (existing.firstProductName === '—') {
        existing.firstProductName = productName;
      }

      orderItemStats.set(orderId, existing);
    }

    const orderRows = ordersSnapshot.docs
      .map((snapshotDoc) => {
        const data = snapshotDoc.data() as Record<string, unknown>;
        const stats = orderItemStats.get(snapshotDoc.id);

        return {
          id: snapshotDoc.id,
          ...data,
          item_count: stats?.itemCount ?? 0,
          first_product_name: stats?.firstProductName ?? '—',
        } as Record<string, unknown>;
      })
      .sort((firstRow, secondRow) => {
        const firstDate = Date.parse(toText(firstRow.created_at || firstRow.createdAt));
        const secondDate = Date.parse(toText(secondRow.created_at || secondRow.createdAt));
        return (Number.isNaN(secondDate) ? 0 : secondDate) - (Number.isNaN(firstDate) ? 0 : firstDate);
      });

    const mappedOrders = orderRows.map(mapOrderRow);
    setOrders(mappedOrders);
  }, []);

  const hydrateCustomers = useCallback(async () => {
    setIsCustomersLoading(true);

    try {
      const firestore = getFirestore();
      const snapshot = await getDocs(collection(firestore, 'profiles'));

      const mappedCustomers = snapshot.docs
        .map((snapshotDoc) => mapCustomerRow({
          id: snapshotDoc.id,
          ...(snapshotDoc.data() as Record<string, unknown>),
        }))
        .sort((firstCustomer, secondCustomer) => {
          const firstDate = Date.parse(firstCustomer.createdAt || '');
          const secondDate = Date.parse(secondCustomer.createdAt || '');
          return (Number.isNaN(secondDate) ? 0 : secondDate) - (Number.isNaN(firstDate) ? 0 : firstDate);
        });

      setCustomers(mappedCustomers);
      setHasLoadedCustomers(true);
    } finally {
      setIsCustomersLoading(false);
    }
  }, []);

  const hydrateTopProducts = useCallback(async () => {
    const firestore = getFirestore();
    const [productsSnapshot, orderItemsSnapshot] = await Promise.all([
      getDocs(collection(firestore, 'products')),
      getDocs(collection(firestore, 'orderItems')),
    ]);

    const productsById = new Map<string, AdminProduct>();

    // 1. Pre-fill with the full massive local JSON catalog
    for (const localProduct of localCatalogProducts) {
      productsById.set(localProduct.id, mapCatalogProduct(localProduct));
    }

    // 2. Overlay any manual overrides made by Admins in Firestore
    for (const productDoc of productsSnapshot.docs) {
      const mappedProduct = mapProductRow({
        id: productDoc.id,
        ...(productDoc.data() as Record<string, unknown>),
      });
      productsById.set(mappedProduct.id, mappedProduct);
    }

    const productStats = new Map<string, { quantitySold: number; revenue: number }>();

    for (const orderItemDoc of orderItemsSnapshot.docs) {
      const data = orderItemDoc.data() as Record<string, unknown>;
      const productId = toText(data.product_id || data.productId);
      if (!productId) continue;

      const quantity = Math.max(1, Math.floor(toNumber(data.quantity, 1)));
      const unitPrice = toNumber(data.unit_price ?? data.unitPrice ?? data.price);
      const existing = productStats.get(productId) || { quantitySold: 0, revenue: 0 };

      existing.quantitySold += quantity;
      existing.revenue += quantity * unitPrice;
      productStats.set(productId, existing);
    }

    const rankedTopProducts = Array.from(productStats.entries())
      .map(([productId, stats]) => {
        const product = productsById.get(productId);

        return {
          id: productId,
          name: product?.name || 'Untitled Product',
          brand: product?.brand || 'Unknown Brand',
          image: product?.image || resolveDefaultImage(),
          rating: product?.rating || 0,
          quantitySold: stats.quantitySold,
          revenue: Number(stats.revenue.toFixed(2)),
        } satisfies TopProduct;
      })
      .sort((firstProduct, secondProduct) => secondProduct.quantitySold - firstProduct.quantitySold);

    if (rankedTopProducts.length > 0) {
      setTopProducts(rankedTopProducts);
      return;
    }

    const fallbackTopProducts = Array.from(productsById.values())
      .sort((firstProduct, secondProduct) => secondProduct.rating - firstProduct.rating)
      .map((product) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        image: product.image,
        rating: product.rating,
        quantitySold: 0,
        revenue: 0,
      }));

    setTopProducts(fallbackTopProducts);
  }, []);

  const hydrateMetrics = useCallback(async () => {
    const firestore = getFirestore();

    const [profilesSnapshot, productsSnapshot, ordersSnapshot] = await Promise.all([
      getDocs(collection(firestore, 'profiles')),
      getDocs(collection(firestore, 'products')),
      getDocs(collection(firestore, 'orders')),
    ]);

    let totalRevenue = 0;
    let processingOrders = 0;
    let shippedOrders = 0;
    let outForDeliveryOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;

    for (const orderDoc of ordersSnapshot.docs) {
      const data = orderDoc.data() as Record<string, unknown>;
      const status = toOrderStatus(data.status);
      const amount = toNumber(data.total_amount ?? data.totalAmount ?? data.amount);

      totalRevenue += amount;

      if (status === 'processing') processingOrders += 1;
      if (status === 'shipped') shippedOrders += 1;
      if (status === 'out_for_delivery') outForDeliveryOrders += 1;
      if (status === 'delivered') deliveredOrders += 1;
      if (status === 'cancelled') cancelledOrders += 1;
    }

    const uniqueProductIds = new Set<string>();
    localCatalogProducts.forEach((p) => uniqueProductIds.add(p.id));
    productsSnapshot.docs.forEach((docSnap) => uniqueProductIds.add(docSnap.id));

    setMetrics({
      totalUsers: profilesSnapshot.size,
      totalProducts: uniqueProductIds.size,
      totalOrders: ordersSnapshot.size,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      processingOrders,
      shippedOrders,
      outForDeliveryOrders,
      deliveredOrders,
      cancelledOrders,
    });
  }, []);

  const hydrateRecommendationInsights = useCallback(async (forceAttempt = false) => {
    if (!isRecommendationAnalyticsAvailable && !forceAttempt) return;

    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    startDate.setDate(startDate.getDate() - 29);

    const dayBuckets = new Map<string, RecommendationTrendPoint>();
    const orderedDayKeys: string[] = [];

    for (let offset = 0; offset < 30; offset += 1) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + offset);

      const dayKey = current.toISOString().slice(0, 10);
      orderedDayKeys.push(dayKey);
      dayBuckets.set(dayKey, {
        day: current.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        for_you: 0,
        wishlist_inspired: 0,
        similar_products: 0,
        trending: 0,
        total: 0,
      });
    }

    let rows: Record<string, unknown>[] = [];

    try {
      const firestore = getFirestore();
      const snapshot = await getDocs(collection(firestore, 'recommendationEvents'));

      rows = snapshot.docs
        .map((snapshotDoc): Record<string, unknown> => ({
          id: snapshotDoc.id,
          ...((snapshotDoc.data() as Record<string, unknown>) || {}),
        }))
        .filter((row) => {
          const computedAt = toDateValue(
            row['computed_at']
            || row['computedAt']
            || row['created_at']
            || row['createdAt']
            || row['timestamp'],
          );

          return Boolean(computedAt && computedAt >= startDate);
        });
    } catch (error) {
      setRecommendationTrendData([]);
      setRecommendationModelData([]);
      setIsRecommendationAnalyticsAvailable(false);
      return;
    }

    const modelBuckets = new Map<string, { records: number; scoreSum: number; inferredRecords: number }>();

    rows.forEach((row) => {
      const recommendationType = toRecommendationType(row);
      const modelVersionMeta = resolveModelVersion(row, recommendationType);
      const computedAt = toDateValue(
        row['computed_at']
        || row['computedAt']
        || row['created_at']
        || row['createdAt']
        || row['timestamp'],
      );
      const score = toNumber(row['score'], 0);

      const existingModelBucket = modelBuckets.get(modelVersionMeta.modelVersion) || {
        records: 0,
        scoreSum: 0,
        inferredRecords: 0,
      };
      existingModelBucket.records += 1;
      existingModelBucket.scoreSum += score;
      if (modelVersionMeta.source === 'inferred') {
        existingModelBucket.inferredRecords += 1;
      }
      modelBuckets.set(modelVersionMeta.modelVersion, existingModelBucket);

      if (!computedAt) {
        return;
      }

      const dayKey = computedAt.toISOString().slice(0, 10);
      const point = dayBuckets.get(dayKey);

      if (!point) {
        return;
      }

      point[recommendationType] += 1;
      point.total += 1;
    });

    setRecommendationTrendData(
      orderedDayKeys
        .map((key) => dayBuckets.get(key))
        .filter((point): point is RecommendationTrendPoint => Boolean(point)),
    );

    setRecommendationModelData(
      Array.from(modelBuckets.entries())
        .map(([modelVersion, value]) => ({
          modelVersion,
          records: value.records,
          averageScore: Number((value.scoreSum / Math.max(value.records, 1)).toFixed(3)),
          source: (value.inferredRecords === value.records ? 'inferred' : 'reported') as 'inferred' | 'reported',
        }))
        .sort((a, b) => b.records - a.records)
        .slice(0, 8),
    );
    setIsRecommendationAnalyticsAvailable(true);
  }, [isRecommendationAnalyticsAvailable]);

  const refreshDashboardData = useCallback(async (showLoader: boolean, forceRetryRecommendationAnalytics = false) => {
    if (showLoader) {
      setIsBootstrapping(true);
    }

    try {
      await Promise.all([
        hydrateMetrics(),
        hydrateTopProducts(),
        hydrateOrders(),
        hydrateRecommendationInsights(forceRetryRecommendationAnalytics),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch admin dashboard data.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      if (showLoader) {
        setIsBootstrapping(false);
      }
    }
  }, [hydrateMetrics, hydrateOrders, hydrateRecommendationInsights, hydrateTopProducts, toast]);

  useEffect(() => {
    void refreshDashboardData(true);
  }, [refreshDashboardData]);

  useEffect(() => {
    if (tab === 'products' && !hasLoadedProducts && !isProductsLoading) {
      void hydrateProducts();
    }

    if (tab === 'customers' && !hasLoadedCustomers && !isCustomersLoading) {
      void hydrateCustomers();
    }
  }, [
    hasLoadedCustomers,
    hasLoadedProducts,
    hydrateCustomers,
    hydrateProducts,
    isCustomersLoading,
    isProductsLoading,
    tab,
  ]);

  useEffect(() => {
    if (!viewOrder) return;

    const updatedOrder = orders.find((order) => order.id === viewOrder.id);
    if (!updatedOrder) {
      setViewOrder(null);
      return;
    }

    if (
      updatedOrder.status !== viewOrder.status
      || updatedOrder.amount !== viewOrder.amount
      || updatedOrder.items !== viewOrder.items
      || updatedOrder.address !== viewOrder.address
    ) {
      setViewOrder(updatedOrder);
    }
  }, [orders, viewOrder]);

  const dbCategories = useMemo(
    () => Array.from(new Set(adminProducts.map((product) => product.category).filter(Boolean))),
    [adminProducts],
  );

  const availableCategories = useMemo(() => {
    const merged = new Set<string>([...BASE_CATEGORIES, ...dbCategories, ...customCategories].filter(Boolean));
    return Array.from(merged);
  }, [customCategories, dbCategories]);

  const allCategories = useMemo(() => ['All', ...availableCategories], [availableCategories]);

  useEffect(() => {
    if (productCatFilter !== 'All' && !allCategories.includes(productCatFilter)) {
      setProductCatFilter('All');
    }
  }, [allCategories, productCatFilter]);

  const filteredProducts = useMemo(() => {
    let list = adminProducts;

    if (productCatFilter !== 'All') {
      list = list.filter((product) => product.category === productCatFilter);
    }

    if (productSearch.trim()) {
      const query = productSearch.toLowerCase();
      list = list.filter((product) =>
        product.name.toLowerCase().includes(query)
        || product.brand.toLowerCase().includes(query)
        || product.subCategory.toLowerCase().includes(query),
      );
    }

    return list;
  }, [adminProducts, productCatFilter, productSearch]);

  const filteredOrders = useMemo(() => {
    let list = orders;

    if (orderStatusFilter !== 'All') {
      list = list.filter((order) => order.status === orderStatusFilter);
    }

    if (orderSearch.trim()) {
      const query = orderSearch.toLowerCase();
      list = list.filter((order) =>
        order.displayId.toLowerCase().includes(query)
        || order.customer.toLowerCase().includes(query)
        || order.email.toLowerCase().includes(query),
      );
    }

    return list;
  }, [orderSearch, orderStatusFilter, orders]);

  const filteredCustomers = useMemo(() => {
    let list = customers;

    if (customerRoleFilter !== 'All') {
      list = list.filter((customer) => customer.role === customerRoleFilter);
    }

    if (customerSearch.trim()) {
      const query = customerSearch.toLowerCase();
      list = list.filter((customer) =>
        customer.fullName.toLowerCase().includes(query)
        || customer.email.toLowerCase().includes(query)
        || customer.phone.toLowerCase().includes(query)
        || customer.city.toLowerCase().includes(query),
      );
    }

    return list;
  }, [customerRoleFilter, customerSearch, customers]);

  const totalRecommendationRows = useMemo(
    () => recommendationTrendData.reduce((total, item) => total + item.total, 0),
    [recommendationTrendData],
  );

  const totalModelRows = useMemo(
    () => recommendationModelData.reduce((total, item) => total + item.records, 0),
    [recommendationModelData],
  );

  const inferredModelRows = useMemo(
    () => recommendationModelData.reduce((total, item) => total + (item.source === 'inferred' ? item.records : 0), 0),
    [recommendationModelData],
  );

  const hasRecommendationHistory = totalRecommendationRows > 0;

  const visibleTopProducts = useMemo(
    () => (showAllTopProducts ? topProducts : topProducts.slice(0, 5)),
    [showAllTopProducts, topProducts],
  );

  const overviewGraphData = useMemo(() => {
    if (overviewGraphMode === 'top_products') {
      return topProducts.slice(0, 12).map((product) => ({
        label: product.name,
        value: product.quantitySold,
      }));
    }

    const days = 14;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - (days - 1));

    const bucketMap = new Map<string, { label: string; orders: number; revenue: number }>();
    const toLocalKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;


    for (let offset = 0; offset < days; offset += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + offset);
      const key = toLocalKey(day);

      bucketMap.set(key, {
        label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        orders: 0,
        revenue: 0,
      });
    }

    orders.forEach((order) => {
      if (!order.createdAtMs) return;
      const date = new Date(order.createdAtMs);
      const key = toLocalKey(date);
      const bucket = bucketMap.get(key);

      if (!bucket) return;

      bucket.orders += 1;
      bucket.revenue += order.amount;
    });

    return Array.from(bucketMap.values()).map((entry) => ({
      label: entry.label,
      value: overviewGraphMode === 'recent_orders' ? entry.orders : Number(entry.revenue.toFixed(2)),
    }));
  }, [orders, overviewGraphMode, topProducts]);

  const overviewGraphTitle = useMemo(() => {
    if (overviewGraphMode === 'top_products') return 'Top Selling Products Graph';
    if (overviewGraphMode === 'recent_orders') return 'Recent Orders Graph (14 days)';
    return 'Revenue Graph (14 days)';
  }, [overviewGraphMode]);

  const overviewGraphEmptyLabel = useMemo(() => {
    if (overviewGraphMode === 'top_products') return 'No top selling product data available yet.';
    if (overviewGraphMode === 'recent_orders') return 'No recent order data available yet.';
    return 'No recent revenue data available yet.';
  }, [overviewGraphMode]);

  const overviewGraphTheme = useMemo(
    () => getOverviewGraphTheme(overviewGraphMode),
    [overviewGraphMode],
  );

  const kpis = useMemo(() => {
    const totalOrders = metrics?.totalOrders || 0;
    const delivered = metrics?.deliveredOrders || 0;
    const cancelled = metrics?.cancelledOrders || 0;
    const processing = metrics?.processingOrders || 0;

    const orderHealth = totalOrders > 0
      ? Number((((delivered - cancelled) / totalOrders) * 100).toFixed(1))
      : 0;

    const revenuePressure = totalOrders > 0
      ? Number((-(processing / totalOrders) * 100).toFixed(1))
      : 0;

    return [
      {
        icon: Users,
        label: 'Total Users',
        value: (metrics?.totalUsers || 0).toLocaleString('en-IN'),
        change: 0,
        accent: 'text-violet-600',
        bg: 'bg-violet-50',
      },
      {
        icon: Package,
        label: 'Total Products',
        value: (metrics?.totalProducts || 0).toLocaleString('en-IN'),
        change: 0,
        accent: 'text-sky-600',
        bg: 'bg-sky-50',
      },
      {
        icon: ShoppingCart,
        label: 'Total Orders',
        value: (metrics?.totalOrders || 0).toLocaleString('en-IN'),
        change: orderHealth,
        accent: 'text-amber-600',
        bg: 'bg-amber-50',
      },
      {
        icon: DollarSign,
        label: 'Total Revenue',
        value: formatCurrency(metrics?.totalRevenue || 0),
        change: revenuePressure,
        accent: 'text-emerald-600',
        bg: 'bg-emerald-50',
      },
    ];
  }, [metrics]);

  const openAddProduct = () => {
    const defaultCategory = availableCategories[0] || 'Apparel';

    setEditingProduct(null);
    setProductForm({ ...EMPTY_FORM, category: defaultCategory });
    setShowProductModal(true);
  };

  const openEditProduct = (product: AdminProduct) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      brand: product.brand,
      price: product.price,
      originalPrice: product.originalPrice,
      category: product.category,
      subCategory: product.subCategory,
      image: product.image,
      stock: product.stock,
    });
    setShowProductModal(true);
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;

    if (!allCategories.includes(trimmed)) {
      setCustomCategories((prev) => [...prev, trimmed]);
    }

    setProductForm((prev) => ({ ...prev, category: trimmed }));
    setNewCategory('');
  };

  const saveProduct = async () => {
    const normalizedName = productForm.name.trim();
    const normalizedBrand = productForm.brand.trim();
    const normalizedCategory = productForm.category.trim() || 'Apparel';
    const normalizedSubCategory = productForm.subCategory.trim() || 'General';
    const normalizedImage = productForm.image.trim() || resolveDefaultImage();
    const safePrice = Number(Number(productForm.price || 0).toFixed(2));
    const safeOriginalPrice =
      productForm.originalPrice == null || Number.isNaN(Number(productForm.originalPrice))
        ? null
        : Number(Number(productForm.originalPrice).toFixed(2));
    const safeStock = Math.max(0, Math.floor(Number(productForm.stock || 0)));

    if (!normalizedName || !normalizedBrand || safePrice < 0) {
      toast({
        title: 'Please provide valid product name, brand, and price.',
        variant: 'destructive',
      });
      return;
    }

    const firestore = getFirestore();
    const now = new Date().toISOString();

    const mutationPayload = {
      name: normalizedName,
      brand: normalizedBrand,
      price: safePrice,
      original_price: safeOriginalPrice,
      originalPrice: safeOriginalPrice,
      master_category: normalizedCategory,
      masterCategory: normalizedCategory,
      sub_category: normalizedSubCategory,
      subCategory: normalizedSubCategory,
      article_type: normalizedSubCategory,
      articleType: normalizedSubCategory,
      category: normalizeCategorySlug(normalizedCategory),
      image_url: normalizedImage,
      imageUrl: normalizedImage,
      stock: safeStock,
      gender: 'Unisex',
      updated_at: now,
      updatedAt: now,
    };

    setIsSavingProduct(true);

    try {
      if (editingProduct) {
        await setDoc(
          doc(firestore, 'products', editingProduct.id),
          {
            id: editingProduct.id,
            ...mutationPayload,
          },
          { merge: true },
        );

        toast({ title: 'Product updated successfully.' });
      } else {
        const generatedId = `ADM-${Date.now()}`;

        await setDoc(doc(firestore, 'products', generatedId), {
          id: generatedId,
          ...mutationPayload,
          created_at: now,
          createdAt: now,
          rating: 0,
          reviews: 0,
        });

        toast({ title: 'Product added successfully.' });
      }

      await Promise.all([hydrateProducts(), hydrateMetrics(), hydrateTopProducts()]);
      setShowProductModal(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save product right now.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSavingProduct(false);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const firestore = getFirestore();
      await deleteDoc(doc(firestore, 'products', id));

      await Promise.all([hydrateProducts(), hydrateMetrics(), hydrateTopProducts()]);
      setDeleteConfirm(null);
      toast({ title: 'Product deleted.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete product right now.';
      toast({ title: message, variant: 'destructive' });
    }
  };

  const openEditCustomer = (customer: AdminCustomer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      fullName: customer.fullName,
      phone: customer.phone === '—' ? '' : customer.phone,
      gender: customer.gender === '—' ? '' : customer.gender,
      role: customer.role,
      address: customer.address,
      city: customer.city,
      pincode: customer.pincode,
    });
    setShowCustomerModal(true);
  };

  const saveCustomer = async () => {
    if (!editingCustomer) {
      toast({ title: 'No customer selected.', variant: 'destructive' });
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      full_name: customerForm.fullName.trim() || null,
      fullName: customerForm.fullName.trim() || null,
      phone: customerForm.phone.trim() || null,
      gender: customerForm.gender.trim() || null,
      role: customerForm.role,
      address: customerForm.address.trim() || null,
      city: customerForm.city.trim() || null,
      pincode: customerForm.pincode.trim() || null,
      updated_at: now,
      updatedAt: now,
    };

    setIsSavingCustomer(true);

    try {
      const firestore = getFirestore();
      await setDoc(doc(firestore, 'profiles', editingCustomer.id), payload, { merge: true });

      await Promise.all([hydrateCustomers(), hydrateMetrics()]);
      setShowCustomerModal(false);
      setEditingCustomer(null);
      toast({ title: 'Customer details updated successfully.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update customer right now.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const appointCustomerAsAdmin = async (customer: AdminCustomer) => {
    if (customer.role === 'admin') {
      toast({ title: 'This user is already an admin.' });
      return;
    }

    const targetEmail = customer.email.trim();
    if (!targetEmail || targetEmail === '—') {
      toast({ title: 'Customer email is required to appoint admin.', variant: 'destructive' });
      return;
    }

    const isConfirmed = window.confirm(`Appoint ${customer.fullName} (${targetEmail}) as a new admin?`);
    if (!isConfirmed) {
      return;
    }

    setAppointingAdminId(customer.id);

    try {
      const firestore = getFirestore();
      const now = new Date().toISOString();

      await setDoc(
        doc(firestore, 'profiles', customer.id),
        {
          role: 'admin',
          updated_at: now,
          updatedAt: now,
        },
        { merge: true },
      );

      await Promise.all([hydrateCustomers(), hydrateMetrics()]);
      toast({ title: `${customer.fullName} appointed as admin in Firebase.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to appoint admin right now.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setAppointingAdminId(null);
    }
  };

  const updateOrderStatus = useCallback(async (orderId: string, nextStatus: OrderStatus) => {
    setIsUpdatingOrder(true);

    try {
      const firestore = getFirestore();
      const now = new Date().toISOString();

      await setDoc(
        doc(firestore, 'orders', orderId),
        {
          status: nextStatus,
          updated_at: now,
          updatedAt: now,
        },
        { merge: true },
      );

      await Promise.all([hydrateOrders(), hydrateMetrics()]);
      setCancelConfirm(null);
      toast({ title: `Order marked as ${STATUS_LABELS[nextStatus]}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update order status right now.';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsUpdatingOrder(false);
    }
  }, [hydrateMetrics, hydrateOrders, toast]);

  const advanceStatus = async (id: string) => {
    const order = orders.find((entry) => entry.id === id);
    if (!order) return;

    if (order.status === 'cancelled' || order.status === 'delivered') return;

    const index = STATUS_FLOW.indexOf(order.status);
    const nextStatus = STATUS_FLOW[Math.min(index + 1, STATUS_FLOW.length - 1)];
    await updateOrderStatus(id, nextStatus);
  };

  const cancelOrder = async (id: string) => {
    await updateOrderStatus(id, 'cancelled');
  };

  const handleRefresh = () => {
    void refreshDashboardData(false, !isRecommendationAnalyticsAvailable);

    if (tab === 'products') {
      void hydrateProducts().catch((error) => {
        const message = error instanceof Error ? error.message : 'Unable to refresh products right now.';
        toast({ title: message, variant: 'destructive' });
      });
    }

    if (tab === 'customers') {
      void hydrateCustomers().catch((error) => {
        const message = error instanceof Error ? error.message : 'Unable to refresh customers right now.';
        toast({ title: message, variant: 'destructive' });
      });
    }
  };

  const handleDownloadReport = () => {
    try {
      const wb = XLSX.utils.book_new();

      const _metrics = metrics ? [{
        GeneratedAt: new Date().toISOString(),
        TotalUsers: metrics.totalUsers,
        TotalProducts: metrics.totalProducts,
        TotalOrders: metrics.totalOrders,
        TotalRevenue: metrics.totalRevenue,
        ProcessingOrders: metrics.processingOrders,
        ShippedOrders: metrics.shippedOrders,
        OutForDeliveryOrders: metrics.outForDeliveryOrders,
        DeliveredOrders: metrics.deliveredOrders,
        CancelledOrders: metrics.cancelledOrders,
      }] : [];
      const wsMetrics = XLSX.utils.json_to_sheet(_metrics);
      XLSX.utils.book_append_sheet(wb, wsMetrics, "Metrics");

      const _orders = orders.map(o => ({
        OrderID: o.id,
        DisplayID: o.displayId,
        CustomerName: o.customer,
        CustomerEmail: o.email,
        Amount: o.amount,
        Status: o.status,
        Date: o.date,
        CreatedAtMs: o.createdAtMs,
        ItemsCount: o.items,
        DeliveryAddress: o.address,
        ProductNameSummary: o.product,
      }));
      const wsOrders = XLSX.utils.json_to_sheet(_orders);
      XLSX.utils.book_append_sheet(wb, wsOrders, "Orders");

      const _products = adminProducts.map(p => ({
        ProductID: p.id,
        Name: p.name,
        Brand: p.brand,
        Category: p.category,
        SubCategory: p.subCategory,
        Price: p.price,
        OriginalPrice: p.originalPrice || '',
        Stock: p.stock,
        Rating: p.rating,
        ImageURL: p.image,
      }));
      const wsProducts = XLSX.utils.json_to_sheet(_products);
      XLSX.utils.book_append_sheet(wb, wsProducts, "Products");

      const _topProducts = topProducts.map(p => ({
        ProductID: p.id,
        Name: p.name,
        Brand: p.brand,
        Rating: p.rating,
        QuantitySold: p.quantitySold,
        Revenue: p.revenue,
        ImageURL: p.image,
      }));
      const wsTopProducts = XLSX.utils.json_to_sheet(_topProducts);
      XLSX.utils.book_append_sheet(wb, wsTopProducts, "Top Products");

      const _customers = customers.map(c => ({
        CustomerID: c.id,
        Name: c.fullName,
        Email: c.email,
        Phone: c.phone,
        Gender: c.gender,
        Role: c.role,
        Address: c.address,
        City: c.city,
        Pincode: c.pincode,
        JoinedAt: c.joinedAt,
        CreatedAt: c.createdAt,
        UpdatedAt: c.updatedAt,
      }));
      const wsCustomers = XLSX.utils.json_to_sheet(_customers);
      XLSX.utils.book_append_sheet(wb, wsCustomers, "Customers");

      const _recTrends = recommendationTrendData.map(r => ({
        Day: r.day,
        ForYou: r.for_you,
        WishlistInspired: r.wishlist_inspired,
        SimilarProducts: r.similar_products,
        Trending: r.trending,
        Total: r.total,
      }));
      const wsRecTrends = XLSX.utils.json_to_sheet(_recTrends);
      XLSX.utils.book_append_sheet(wb, wsRecTrends, "Recommendation Trends");

      const _modelBreakdown = recommendationModelData.map(m => ({
        ModelVersion: m.modelVersion,
        Records: m.records,
        AverageScore: m.averageScore,
        Source: m.source,
      }));
      const wsModelBreakdown = XLSX.utils.json_to_sheet(_modelBreakdown);
      XLSX.utils.book_append_sheet(wb, wsModelBreakdown, "Model Breakdown");

      const fileName = `tulip_admin_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Report Downloaded",
        description: "The full report has been downloaded as an Excel sheet successfully.",
      });
    } catch (err) {
      console.error("Export report error:", err);
      toast({
        title: "Download Failed",
        description: "There was an error generating the report.",
        variant: "destructive"
      });
    }
  };

  const TABS = [
    { id: 'overview' as Tab, label: 'Overview', Icon: LayoutDashboard },
    { id: 'products' as Tab, label: 'Products', Icon: Package },
    { id: 'customers' as Tab, label: 'Customers', Icon: Users },
    { id: 'orders' as Tab, label: 'Orders', Icon: ShoppingCart },
  ];

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-secondary/40 pt-20 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-background border border-border rounded-2xl p-8 text-center">
            <h1 className="font-display text-2xl font-semibold mb-2">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Firebase is not configured. Add your Firebase environment variables to load dashboard data.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-secondary/40 pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[60vh] flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-secondary/40 pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div {...fade(0)} className="flex items-center justify-between py-6 mb-2 px-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Welcome back, Admin · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg bg-background/80 hover:bg-secondary transition-colors shadow-sm"
            >
              <Download size={14} /> Download Report
            </button>
            <button
              onClick={handleRefresh}
              className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background/80 hover:bg-secondary transition-colors shadow-sm"
            >
              Refresh
            </button>
            <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-background/70">
              <ArrowUpRight size={14} /> View Store
            </Link>
          </div>
        </motion.div>

        {/* Tab bar */}
        <motion.div {...fade(0.05)} className="flex gap-1 bg-background/95 border border-border rounded-xl p-1 mb-7 w-fit shadow-sm">
          {TABS.map((tabOption) => (
            <button
              key={tabOption.id}
              onClick={() => setTab(tabOption.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${tab === tabOption.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
            >
              <tabOption.Icon size={15} />
              {tabOption.label}
            </button>
          ))}
        </motion.div>

        {/* ════════ OVERVIEW ════════ */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              {kpis.map((kpi, index) => {
                const up = kpi.change >= 0;
                return (
                  <motion.div
                    key={kpi.label}
                    {...fade(0.06 * index)}
                    className="bg-background rounded-2xl border border-border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                        <kpi.icon className={`w-5 h-5 ${kpi.accent}`} />
                      </div>
                      <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(kpi.change)}%
                      </span>
                    </div>
                    <p className="font-display text-2xl font-bold tracking-tight">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Top Products */}
              <motion.div {...fade(0.25)} className="lg:col-span-2 bg-background rounded-2xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-base font-semibold">Top Selling Products</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAllTopProducts((prev) => !prev)}
                      className="text-[11px] font-medium text-primary hover:underline underline-offset-2"
                    >
                      {showAllTopProducts ? 'Show less' : 'See all'}
                    </button>
                    <span className="flex items-center gap-1 text-xs text-primary font-medium"><Star size={12} className="fill-primary" /> Sales data</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {topProducts.length === 0 && (
                    <p className="text-xs text-muted-foreground">No product sales data yet.</p>
                  )}

                  {visibleTopProducts.map((product, index) => (
                    <div key={product.id || `${product.name}-${index}`} className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${index === 0 ? 'bg-amber-400 text-white'
                          : index === 1 ? 'bg-slate-300 text-white'
                            : index === 2 ? 'bg-orange-400 text-white'
                              : 'bg-secondary text-muted-foreground'
                        }`}>{index + 1}</span>
                      <div className="w-11 h-11 rounded-lg overflow-hidden bg-secondary shrink-0">
                        <img
                          src={product.image || resolveDefaultImage()}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = resolveDefaultImage();
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{product.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{product.brand}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold">{product.quantitySold} sold</p>
                        <p className="text-[10px] flex items-center gap-0.5 justify-end text-muted-foreground">
                          <Star size={9} className="fill-amber-400 text-amber-400" />{product.rating}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Recent Orders */}
              <motion.div {...fade(0.3)} className="lg:col-span-3 bg-background rounded-2xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-base font-semibold">Recent Orders</h2>
                  <button onClick={() => setTab('orders')} className="text-xs text-primary font-medium hover:underline underline-offset-2">View all</button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-border/80">
                      {['Order', 'Customer', 'Amount', 'Status', 'Date'].map((header) => (
                        <th key={header} className="pb-2 text-xs font-medium text-muted-foreground">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/80">
                    {orders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="hover:bg-secondary/40 transition-colors">
                        <td className="py-2.5 text-xs font-mono text-muted-foreground">{order.displayId}</td>
                        <td className="py-2.5 text-xs font-medium">{order.customer}</td>
                        <td className="py-2.5 text-xs font-semibold">{formatCurrency(order.amount)}</td>
                        <td className="py-2.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                            {STATUS_LABELS[order.status]}
                          </span>
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">{order.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                onClick={() => setShowOverviewGraphs((prev) => !prev)}
                className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background/80 hover:bg-secondary transition-colors shadow-sm"
              >
                {showOverviewGraphs ? 'Hide Graphs' : 'Show Graphs'}
              </button>
            </div>

            {/* Overview Graphs */}
            {showOverviewGraphs && (
              <>
                <motion.div {...fade(0.32)} className={`mt-6 bg-gradient-to-br ${overviewGraphTheme.panel} bg-background rounded-2xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="font-display text-base font-semibold">Business Graph</h2>
                      <p className="text-xs text-muted-foreground">Switch between top products, recent orders, and revenue</p>
                    </div>
                    <div className="flex items-center gap-1 bg-secondary/70 border border-border rounded-xl p-1">
                      {[
                        { id: 'top_products' as OverviewGraphMode, label: 'Top Sell' },
                        { id: 'recent_orders' as OverviewGraphMode, label: 'Recent Orders' },
                        { id: 'revenue' as OverviewGraphMode, label: 'Revenue' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setOverviewGraphMode(option.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${overviewGraphMode === option.id
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3 text-xs text-muted-foreground">{overviewGraphTitle}</div>

                  {overviewGraphData.length > 0 ? (
                    <ChartContainer config={OVERVIEW_GRAPH_CONFIG} className="w-full rounded-xl border border-border/60 bg-background/70 p-2 sm:p-3">
                      {overviewGraphMode === 'top_products' ? (
                        <BarChart data={overviewGraphData} margin={{ left: 10, right: 10, top: 8, bottom: 6 }}>
                          <defs>
                            <linearGradient id="overviewBarGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={overviewGraphTheme.gradientStart} stopOpacity={0.95} />
                              <stop offset="95%" stopColor={overviewGraphTheme.gradientEnd} stopOpacity={0.6} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="3 4" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} interval={0} minTickGap={16} />
                          <YAxis axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                          <Bar dataKey="value" fill="url(#overviewBarGradient)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      ) : (
                        <LineChart data={overviewGraphData} margin={{ left: 10, right: 10, top: 8, bottom: 6 }}>
                          <defs>
                            <linearGradient id="overviewLineGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor={overviewGraphTheme.gradientStart} />
                              <stop offset="100%" stopColor={overviewGraphTheme.gradientEnd} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="3 4" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} minTickGap={24} />
                          <YAxis axisLine={false} tickLine={false} allowDecimals={overviewGraphMode === 'revenue'} width={40} />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                          <Line type="monotone" dataKey="value" stroke="url(#overviewLineGradient)" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: overviewGraphTheme.stroke, stroke: '#ffffff', strokeWidth: 2 }} />
                        </LineChart>
                      )}
                    </ChartContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center border border-dashed border-border rounded-xl text-sm text-muted-foreground">
                      {overviewGraphEmptyLabel}
                    </div>
                  )}
                </motion.div>

                {/* ML recommendation insights */}
                <motion.div {...fade(0.35)} className="mt-6 grid grid-cols-1 xl:grid-cols-5 gap-6">
                  <motion.div {...fade(0.38)} className="xl:col-span-3 bg-gradient-to-br from-indigo-50/70 via-blue-50/30 to-transparent bg-background rounded-2xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h2 className="font-display text-base font-semibold">ML Recommendation Trends</h2>
                        <p className="text-xs text-muted-foreground">All recommendation models · Last 30 days</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {isRecommendationAnalyticsAvailable
                          ? `${totalRecommendationRows.toLocaleString('en-IN')} rows`
                          : 'Not configured'}
                      </span>
                    </div>

                    {isRecommendationAnalyticsAvailable && hasRecommendationHistory ? (
                      <ChartContainer config={RECOMMENDATION_TREND_CONFIG} className="w-full rounded-xl border border-border/60 bg-background/70 p-2 sm:p-3">
                        <LineChart data={recommendationTrendData} margin={{ left: 10, right: 10, top: 8, bottom: 6 }}>
                          <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="3 4" />
                          <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tickMargin={8}
                            minTickGap={24}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                            width={30}
                          />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          {RECOMMENDATION_TYPES.map((type) => (
                            <Line
                              key={type}
                              type="monotone"
                              dataKey={type}
                              stroke={RECOMMENDATION_TREND_COLORS[type]}
                              strokeWidth={2.8}
                              dot={false}
                              activeDot={{ r: 5, fill: RECOMMENDATION_TREND_COLORS[type], stroke: '#ffffff', strokeWidth: 2 }}
                            />
                          ))}
                        </LineChart>
                      </ChartContainer>
                    ) : (
                      <div className="h-[260px] flex items-center justify-center border border-dashed border-border rounded-xl text-sm text-muted-foreground">
                        {isRecommendationAnalyticsAvailable
                          ? 'No recommendation history available yet.'
                          : 'Recommendation analytics tables are not configured in this database yet.'}
                      </div>
                    )}
                  </motion.div>

                  <motion.div {...fade(0.42)} className="xl:col-span-2 bg-gradient-to-br from-violet-50/70 via-fuchsia-50/30 to-transparent bg-background rounded-2xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h2 className="font-display text-base font-semibold">Model Versions</h2>
                        <p className="text-xs text-muted-foreground">Reported + inferred model versions</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{recommendationModelData.length} models</span>
                    </div>

                    {isRecommendationAnalyticsAvailable && recommendationModelData.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Rows</p>
                            <p className="text-sm font-semibold">{totalModelRows.toLocaleString('en-IN')}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Inferred</p>
                            <p className="text-sm font-semibold">{inferredModelRows.toLocaleString('en-IN')}</p>
                          </div>
                        </div>

                        <ChartContainer config={RECOMMENDATION_MODEL_CONFIG} className="w-full rounded-xl border border-border/60 bg-background/70 p-2 sm:p-3">
                          <BarChart data={recommendationModelData} margin={{ left: 10, right: 10, top: 8, bottom: 6 }}>
                            <defs>
                              <linearGradient id="modelBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.95} />
                                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.65} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#cbd5e1" strokeDasharray="3 4" />
                            <XAxis
                              dataKey="modelVersion"
                              axisLine={false}
                              tickLine={false}
                              tickMargin={8}
                              interval={0}
                              minTickGap={16}
                              tickFormatter={compactModelLabel}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              allowDecimals={false}
                              width={30}
                            />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <Bar dataKey="records" fill="url(#modelBarGradient)" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ChartContainer>

                        <div className="mt-4 space-y-2">
                          {recommendationModelData.map((model) => (
                            <div key={model.modelVersion} className="rounded-lg border border-border px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">{model.modelVersion}</p>
                                  <p className="text-[11px] text-muted-foreground">Avg score: {model.averageScore.toFixed(3)}</p>
                                </div>
                                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${model.source === 'reported'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                  }`}>
                                  {model.source === 'reported' ? 'Reported' : 'Inferred'}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="h-1.5 w-full rounded-full bg-secondary">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${Math.max(6, (model.records / Math.max(totalModelRows, 1)) * 100)}%` }}
                                  />
                                </div>
                                <p className="text-xs font-semibold ml-3">{model.records}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-[260px] flex items-center justify-center border border-dashed border-border rounded-xl text-sm text-muted-foreground">
                        {isRecommendationAnalyticsAvailable
                          ? 'No model-version data available yet.'
                          : 'Model analytics are unavailable until recommendation tables are created.'}
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              </>
            )}

            {/* Quick actions */}
            <motion.div {...fade(0.4)} className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Add Product',
                  Icon: Plus,
                  color: 'from-sky-500 to-blue-600',
                  action: () => {
                    setTab('products');
                    setTimeout(openAddProduct, 120);
                  },
                },
                { label: 'View Customers', Icon: Users, color: 'from-violet-500 to-purple-600', action: () => setTab('customers') },
                { label: 'Manage Orders', Icon: ShoppingCart, color: 'from-amber-500 to-orange-500', action: () => setTab('orders') },
                { label: 'Revenue Trends', Icon: TrendingUp, color: 'from-emerald-500 to-teal-600', action: () => { } },
              ].map((actionItem) => (
                <button
                  key={actionItem.label}
                  onClick={actionItem.action}
                  className={`flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-gradient-to-r ${actionItem.color} text-white text-sm font-medium shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-100 transition-all duration-200`}
                >
                  <actionItem.Icon size={16} />
                  {actionItem.label}
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* ════════ PRODUCTS ════════ */}
        {tab === 'products' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-background border border-border rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Search products…"
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
              </div>
              <div className="relative">
                <select
                  value={productCatFilter}
                  onChange={(event) => setProductCatFilter(event.target.value)}
                  className="appearance-none bg-background border border-border rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none cursor-pointer shadow-sm"
                >
                  {allCategories.map((category) => <option key={category}>{category}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
                <Tag size={13} className="text-muted-foreground shrink-0" />
                <input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && addCategory()}
                  placeholder="New category…"
                  className="w-28 text-sm bg-transparent focus:outline-none"
                />
                <button onClick={addCategory} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">Add</button>
              </div>
              <button
                onClick={openAddProduct}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md"
              >
                <Plus size={15} /> Add Product
              </button>
            </div>

            {isProductsLoading && adminProducts.length === 0 && (
              <div className="bg-background border border-border rounded-xl px-4 py-3 mb-4 text-sm text-muted-foreground flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading products...
              </div>
            )}

            {/* Table */}
            <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-secondary/50">
                    <tr>
                      {['Product', 'Category', 'Price', 'Stock', 'Rating', 'Actions'].map((header) => (
                        <th key={header} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-secondary/30 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary shrink-0">
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="text-sm font-medium leading-tight">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.brand}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border">{product.category}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold">{formatCurrency(product.price)}</p>
                          {product.originalPrice && <p className="text-[10px] text-muted-foreground line-through">{formatCurrency(product.originalPrice)}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${product.stock < 10 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {product.stock} units
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Star size={11} className="fill-amber-400 text-amber-400" />
                            <span className="text-xs font-medium">{product.rating}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditProduct(product)}
                              title="Edit"
                              className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center hover:bg-sky-100 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(product.id)}
                              title="Delete"
                              className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && !isProductsLoading && (
                      <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No products found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
                Showing {filteredProducts.length} of {adminProducts.length} products
                {isProductsBackgroundSyncing && ' · Syncing full catalog in background...'}
              </div>
            </div>
          </motion.div>
        )}

        {/* ════════ CUSTOMERS ════════ */}
        {tab === 'customers' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-background border border-border rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Search customers..."
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
              </div>
              <div className="relative">
                <select
                  value={customerRoleFilter}
                  onChange={(event) => setCustomerRoleFilter(event.target.value as AppRole | 'All')}
                  className="appearance-none bg-background border border-border rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none cursor-pointer shadow-sm"
                >
                  <option value="All">All Roles</option>
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {isCustomersLoading && customers.length === 0 && (
              <div className="bg-background border border-border rounded-xl px-4 py-3 mb-4 text-sm text-muted-foreground flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Loading customers...
              </div>
            )}

            {/* Table */}
            <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-secondary/50">
                    <tr>
                      {['Customer', 'Contact', 'Role', 'Joined', 'Location', 'Actions'].map((header) => (
                        <th key={header} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-secondary/30 transition-colors group">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{customer.fullName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{customer.id.slice(0, 8)}...</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs">{customer.email}</p>
                          <p className="text-xs text-muted-foreground">{customer.phone || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${customer.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
                            {customer.role === 'admin' ? 'Admin' : 'Customer'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{customer.joinedAt}</td>
                        <td className="px-4 py-3 text-xs">
                          <p className="font-medium">{customer.city || '—'}</p>
                          <p className="text-muted-foreground truncate max-w-[220px]">{customer.address || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {customer.role !== 'admin' && (
                              <button
                                onClick={() => void appointCustomerAsAdmin(customer)}
                                title="Appoint as admin"
                                disabled={appointingAdminId === customer.id}
                                className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center hover:bg-violet-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {appointingAdminId === customer.id ? (
                                  <div className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <ShieldCheck size={13} />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => openEditCustomer(customer)}
                              title="Edit customer"
                              className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center hover:bg-sky-100 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredCustomers.length === 0 && !isCustomersLoading && (
                      <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No customers found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
                Showing {filteredCustomers.length} of {customers.length} customers
              </div>
            </div>
          </motion.div>
        )}

        {/* ════════ ORDERS ════════ */}
        {tab === 'orders' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-background border border-border rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="Search orders or customers…"
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
              </div>
              <div className="relative">
                <select
                  value={orderStatusFilter}
                  onChange={(event) => setOrderStatusFilter(event.target.value as OrderStatus | 'All')}
                  className="appearance-none bg-background border border-border rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none cursor-pointer shadow-sm"
                >
                  <option value="All">All</option>
                  {[...STATUS_FLOW, 'cancelled' as const].map((status) => (
                    <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Table */}
            <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-secondary/50">
                    <tr>
                      {['Order ID', 'Customer', 'Product', 'Amount', 'Items', 'Status', 'Date', 'Actions'].map((header) => (
                        <th key={header} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-secondary/30 transition-colors group">
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{order.displayId}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{order.customer}</p>
                          <p className="text-xs text-muted-foreground">{order.email}</p>
                        </td>
                        <td className="px-4 py-3 text-xs">{order.product}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(order.amount)}</td>
                        <td className="px-4 py-3 text-xs text-center">{order.items}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[order.status]}`}>
                            {STATUS_LABELS[order.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{order.date}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setViewOrder(order)}
                              title="View & Track"
                              className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center hover:bg-sky-100 transition-colors"
                            >
                              <Eye size={13} />
                            </button>
                            {order.status !== 'cancelled' && order.status !== 'delivered' && (
                              <button
                                onClick={() => void advanceStatus(order.id)}
                                title="Advance status"
                                className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                                disabled={isUpdatingOrder}
                              >
                                <TrendingUp size={13} />
                              </button>
                            )}
                            {order.status !== 'cancelled' && order.status !== 'delivered' && (
                              <button
                                onClick={() => setCancelConfirm(order.id)}
                                title="Cancel order"
                                className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                                disabled={isUpdatingOrder}
                              >
                                <XCircle size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No orders found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
                Showing {filteredOrders.length} of {orders.length} orders
              </div>
            </div>
          </motion.div>
        )}

        {/* Security badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={13} className="text-emerald-500" />
          Secured admin session · All data encrypted
        </div>

      </div>

      {/* ════════ MODALS ════════ */}

      {/* Add / Edit Product */}
      <AnimatePresence>
        {showProductModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowProductModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative w-full max-w-lg bg-background rounded-2xl border border-border shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="font-display text-base font-semibold">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                {productForm.image && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-secondary mx-auto">
                    <img src={productForm.image} alt="preview" className="w-full h-full object-cover" />
                  </div>
                )}
                {([
                  { label: 'Product Name *', key: 'name', placeholder: 'e.g. Silk Midi Dress' },
                  { label: 'Brand *', key: 'brand', placeholder: 'e.g. TULIP ATELIER' },
                  { label: 'Image URL', key: 'image', placeholder: 'https://…' },
                  { label: 'Sub Category', key: 'subCategory', placeholder: 'e.g. Topwear' },
                ] as { label: string; key: keyof typeof productForm; placeholder: string }[]).map((field) => (
                  <div key={String(field.key)}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{field.label}</label>
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      value={String(productForm[field.key] ?? '')}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={productForm.price || ''}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, price: Number(event.target.value) }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Original Price (₹)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={productForm.originalPrice || ''}
                      onChange={(event) => setProductForm((prev) => ({
                        ...prev,
                        originalPrice: event.target.value ? Number(event.target.value) : undefined,
                      }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                    <select
                      value={productForm.category}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, category: event.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none bg-background"
                    >
                      {availableCategories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Stock (units)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={productForm.stock || ''}
                      onChange={(event) => setProductForm((prev) => ({ ...prev, stock: Number(event.target.value) }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-secondary/30">
                <button
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void saveProduct()}
                  disabled={isSavingProduct}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingProduct ? 'Saving…' : editingProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Customer */}
      <AnimatePresence>
        {showCustomerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
            onClick={() => {
              setShowCustomerModal(false);
              setEditingCustomer(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative w-full max-w-lg bg-background rounded-2xl border border-border shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h3 className="font-display text-base font-semibold">Edit Customer</h3>
                  <p className="text-xs text-muted-foreground">{editingCustomer?.email || '—'}</p>
                </div>
                <button
                  onClick={() => {
                    setShowCustomerModal(false);
                    setEditingCustomer(null);
                  }}
                  className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name</label>
                  <input
                    type="text"
                    value={customerForm.fullName}
                    onChange={(event) => setCustomerForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
                    <input
                      type="text"
                      value={customerForm.phone}
                      onChange={(event) => setCustomerForm((prev) => ({ ...prev, phone: event.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Gender</label>
                    <input
                      type="text"
                      value={customerForm.gender}
                      onChange={(event) => setCustomerForm((prev) => ({ ...prev, gender: event.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
                  <select
                    value={customerForm.role}
                    onChange={(event) => setCustomerForm((prev) => ({ ...prev, role: event.target.value as AppRole }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none bg-background"
                  >
                    <option value="customer">Customer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
                  <input
                    type="text"
                    value={customerForm.address}
                    onChange={(event) => setCustomerForm((prev) => ({ ...prev, address: event.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">City</label>
                    <input
                      type="text"
                      value={customerForm.city}
                      onChange={(event) => setCustomerForm((prev) => ({ ...prev, city: event.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Pincode</label>
                    <input
                      type="text"
                      value={customerForm.pincode}
                      onChange={(event) => setCustomerForm((prev) => ({ ...prev, pincode: event.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-secondary/30">
                <button
                  onClick={() => {
                    setShowCustomerModal(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void saveCustomer()}
                  disabled={isSavingCustomer}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingCustomer ? 'Saving…' : 'Save Customer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative w-full max-w-sm bg-background rounded-2xl border border-border shadow-2xl p-6 text-center"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="font-display text-base font-semibold mb-1">Delete Product?</h3>
              <p className="text-sm text-muted-foreground mb-5">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 text-sm border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void deleteProduct(deleteConfirm)}
                  className="flex-1 py-2 text-sm bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel order confirm */}
      <AnimatePresence>
        {cancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setCancelConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative w-full max-w-sm bg-background rounded-2xl border border-border shadow-2xl p-6 text-center"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <XCircle size={20} className="text-amber-500" />
              </div>
              <h3 className="font-display text-base font-semibold mb-1">Cancel This Order?</h3>
              <p className="text-sm text-muted-foreground mb-5">Status will be set to Cancelled.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCancelConfirm(null)}
                  className="flex-1 py-2 text-sm border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={() => void cancelOrder(cancelConfirm)}
                  className="flex-1 py-2 text-sm bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                  disabled={isUpdatingOrder}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View / Track Order */}
      <AnimatePresence>
        {viewOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setViewOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative w-full max-w-md bg-background rounded-2xl border border-border shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h3 className="font-display text-base font-semibold">{viewOrder.displayId}</h3>
                  <p className="text-xs text-muted-foreground">{viewOrder.date}</p>
                </div>
                <button
                  onClick={() => setViewOrder(null)}
                  className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Customer */}
                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {viewOrder.customer.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{viewOrder.customer}</p>
                    <p className="text-xs text-muted-foreground">{viewOrder.email}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />{viewOrder.address}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(viewOrder.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {viewOrder.items} item{viewOrder.items > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Tracking */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Order Tracking</p>
                  {viewOrder.status === 'cancelled' ? (
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                      <XCircle size={18} className="text-red-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">Order Cancelled</p>
                        <p className="text-xs text-red-400">This order has been cancelled.</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {TRACK_STEPS.map((step, index) => {
                        const currentIndex = STATUS_FLOW.indexOf(viewOrder.status);
                        const stepIndex = STATUS_FLOW.indexOf(step.status);
                        const done = stepIndex <= currentIndex;
                        const active = stepIndex === currentIndex;

                        return (
                          <div key={step.status} className="flex items-start gap-3 mb-3 last:mb-0">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${active
                                  ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/30'
                                  : done
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'bg-background border-border text-muted-foreground'
                                }`}><step.Icon size={14} /></div>
                              {index < TRACK_STEPS.length - 1 && (
                                <div className={`w-0.5 h-5 mt-1 ${done && stepIndex < currentIndex ? 'bg-emerald-400' : 'bg-border'}`} />
                              )}
                            </div>
                            <div className="pt-1">
                              <p className={`text-sm font-medium ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {STATUS_LABELS[step.status]}
                              </p>
                              {active && <p className="text-xs text-muted-foreground">Current status</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {viewOrder.status !== 'cancelled' && viewOrder.status !== 'delivered' && (
                <div className="flex gap-3 px-6 py-4 border-t border-border bg-secondary/30">
                  <button
                    onClick={async () => {
                      await advanceStatus(viewOrder.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
                    disabled={isUpdatingOrder}
                  >
                    <TrendingUp size={14} /> Advance Status
                  </button>
                  <button
                    onClick={() => { setCancelConfirm(viewOrder.id); setViewOrder(null); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                    disabled={isUpdatingOrder}
                  >
                    <XCircle size={14} /> Cancel
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AdminDashboard;
