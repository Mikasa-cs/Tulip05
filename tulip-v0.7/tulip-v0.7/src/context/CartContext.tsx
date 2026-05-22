import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Product } from '@/data/products';
import { useAuth } from '@/context/AuthContext';
import { 
  loadCartItems, 
  addCartItem, 
  deleteCartItem,
  loadWishlistItems,
  addWishlistItem,
  deleteWishlistItem,
  loadProduct,
} from '@/lib/firestore-service';
import { getFirestore_ } from '@/lib/firebase';
import { writeBatch, collection, doc } from 'firebase/firestore';
import { trackRecommendationEvent } from '@/lib/recommendationEvents';

export interface CartItem extends Product {
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}

interface CartContextType {
  items: CartItem[];
  wishlist: Product[];
  isCartOpen: boolean;
  addToCart: (product: Product, quantity?: number, size?: string, color?: string) => void;
  removeFromCart: (productId: string, size?: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string, color?: string) => void;
  clearCart: () => void;
  toggleCart: () => void;
  addToWishlist: (product: Product) => void;
  removeFromWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  isInCart: (productId: string) => boolean;
  cartTotal: number;
  cartCount: number;
  recentlyViewed: Product[];
  addToRecentlyViewed: (product: Product) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const GUEST_CART_KEY = 'tulip_guest_cart';
const GUEST_WISHLIST_KEY = 'tulip_guest_wishlist';

const readGuestCart = (): CartItem[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readGuestWishlist = (): Product[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeGuestCart = (nextItems: CartItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(nextItems));
};

const writeGuestWishlist = (nextWishlist: Product[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(nextWishlist));
};

const normalizeVariantValue = (value?: string) => (value || '').trim().toLowerCase();

const buildCartItemKey = (productId: string, size?: string, color?: string) => {
  const normalizedProductId = String(productId || '').trim();
  const normalizedSize = normalizeVariantValue(size);
  const normalizedColor = normalizeVariantValue(color);
  return `${normalizedProductId}::${normalizedSize}::${normalizedColor}`;
};

const toSafeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry)).filter(Boolean);
};

const toGender = (value: string | null): Product['gender'] => {
  const normalizedValue = (value || '').trim().toLowerCase();

  if (normalizedValue === 'men') return 'Men';
  if (normalizedValue === 'women') return 'Women';
  if (normalizedValue === 'boys') return 'Boys';
  if (normalizedValue === 'girls') return 'Girls';
  return 'Unisex';
};

const toMasterCategory = (value: string | null): Product['masterCategory'] => {
  const normalizedValue = (value || '').trim().toLowerCase();

  if (normalizedValue === 'apparel') return 'Apparel';
  if (normalizedValue === 'accessories') return 'Accessories';
  if (normalizedValue === 'footwear') return 'Footwear';
  if (normalizedValue === 'personal care') return 'Personal Care';
  if (normalizedValue === 'skincare') return 'Skincare';
  return 'Apparel';
};

const toSeason = (value: string | null): Product['season'] => {
  const normalizedValue = (value || '').trim().toLowerCase();

  if (normalizedValue === 'summer') return 'Summer';
  if (normalizedValue === 'fall' || normalizedValue === 'autumn') return 'Fall';
  if (normalizedValue === 'winter') return 'Winter';
  if (normalizedValue === 'spring') return 'Spring';
  return 'Summer';
};

const toUsage = (value: string | null): Product['usage'] => {
  const normalizedValue = (value || '').trim().toLowerCase();

  if (normalizedValue === 'casual') return 'Casual';
  if (normalizedValue === 'ethnic') return 'Ethnic';
  if (normalizedValue === 'formal') return 'Formal';
  if (normalizedValue === 'sports') return 'Sports';
  if (normalizedValue === 'smart casual') return 'Smart Casual';
  if (normalizedValue === 'travel') return 'Travel';
  if (normalizedValue === 'party') return 'Party';
  return 'Casual';
};

const toCategory = (value: string | null): Product['category'] => {
  const normalizedValue = (value || '').trim().toLowerCase();

  if (normalizedValue === 'men') return 'men';
  if (normalizedValue === 'women') return 'women';
  if (normalizedValue === 'kids') return 'kids';
  if (normalizedValue === 'accessories') return 'accessories';
  if (normalizedValue === 'footwear') return 'footwear';
  if (normalizedValue === 'beauty') return 'beauty';
  if (normalizedValue === 'skincare') return 'skincare';
  return 'accessories';
};

const getFallbackProductMap = async (): Promise<Map<string, Product>> => {
  const dataModule = await import('@/data/products');
  return new Map(dataModule.products.map((product) => [product.id, product] as const));
};

const resolveProductsByIds = async (productIds: string[]): Promise<Map<string, Product>> => {
  const uniqueProductIds = [...new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (uniqueProductIds.length === 0) {
    return new Map<string, Product>();
  }

  const resolvedProducts = new Map<string, Product>();

  try {
    // Load all products in parallel instead of sequentially
    const productResults = await Promise.all(
      uniqueProductIds.map(async (productId) => {
        try {
          const product = await loadProduct(productId);
          return { productId, product };
        } catch {
          return { productId, product: null };
        }
      }),
    );

    for (const { productId, product } of productResults) {
      if (product) {
        const p = product as Record<string, any>;
        resolvedProducts.set(productId, {
          id: p.id,
          name: p.name,
          brand: p.brand,
          price: Number(toSafeNumber(p.price, 0).toFixed(2)),
          originalPrice: p.originalPrice == null
            ? undefined
            : Number(toSafeNumber(p.originalPrice, 0).toFixed(2)),
          image: p.imageUrl || '',
          hoverImage: p.hoverImageUrl || undefined,
          gender: toGender(p.gender),
          masterCategory: toMasterCategory(p.masterCategory),
          subCategory: p.subCategory,
          articleType: p.articleType,
          baseColour: p.baseColour || 'Unknown',
          season: toSeason(p.season),
          year: Number.isFinite(Number(p.year)) ? Number(p.year) : new Date().getFullYear(),
          usage: toUsage(p.usage),
          category: toCategory(p.category),
          rating: Number(toSafeNumber(p.rating, 0).toFixed(2)),
          reviews: Math.max(0, Math.floor(toSafeNumber(p.reviews, 0))),
          isNew: Boolean(p.isNew),
          isTrending: Boolean(p.isTrending),
          isAIPick: Boolean(p.isAIPick),
          colors: toStringArray(p.colors),
          sizes: toStringArray(p.sizes),
          description: p.description || undefined,
          material: p.material || undefined,
          fit: p.fit || undefined,
          skinType: p.skinType || undefined,
          notableEffects: toStringArray(p.notableEffects).join(', ') || undefined,
        });
      }
    }
  } catch (error) {
    console.error('Failed to load products from Firestore:', error);
  }

  if (resolvedProducts.size === uniqueProductIds.length) {
    return resolvedProducts;
  }

  try {
    const fallbackProductMap = await getFallbackProductMap();
    for (const productId of uniqueProductIds) {
      if (resolvedProducts.has(productId)) continue;

      const fallbackProduct = fallbackProductMap.get(productId);
      if (fallbackProduct) {
        resolvedProducts.set(productId, fallbackProduct);
      }
    }
  } catch (error) {
    console.error('Failed to load fallback products:', error);
  }

  return resolvedProducts;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn, user, isLoading: authLoading, isFirebaseReady } = useAuth();

  const [items, setItems] = useState<CartItem[]>(() => readGuestCart());
  const [wishlist, setWishlist] = useState<Product[]>(() => readGuestWishlist());
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  const hydratedUserIdRef = useRef<string | null>(null);
  const skipNextCartSyncRef = useRef(false);
  const skipNextWishlistSyncRef = useRef(false);
  const wasLoggedInRef = useRef(isLoggedIn);

  useEffect(() => {
    if (authLoading) return;

    const wasLoggedIn = wasLoggedInRef.current;
    const isLogoutTransition = wasLoggedIn && !isLoggedIn;

    if (isLogoutTransition) {
      hydratedUserIdRef.current = null;
      skipNextCartSyncRef.current = false;
      skipNextWishlistSyncRef.current = false;
      setItems([]);
      setWishlist([]);
      setIsCartOpen(false);
      writeGuestCart([]);
      writeGuestWishlist([]);
    }

    wasLoggedInRef.current = isLoggedIn;
  }, [authLoading, isLoggedIn]);

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn || !user || !isFirebaseReady) {
      hydratedUserIdRef.current = null;
      return;
    }

    if (hydratedUserIdRef.current === user.id) return;

    let isCancelled = false;

    const hydrateFromFirestore = async () => {
      try {
        const [cartData, wishlistData] = await Promise.all([
          loadCartItems(user.id),
          loadWishlistItems(user.id),
        ]);

        const productIdsToResolve = [
          ...cartData.map((item: any) => item.productId),
          ...wishlistData.map((item: any) => item.productId),
        ];

        const productsById = await resolveProductsByIds(productIdsToResolve);

        const nextItems: CartItem[] = cartData.reduce<CartItem[]>((acc, item: any) => {
          const product = productsById.get(item.productId);
          if (!product) return acc;

          acc.push({
            ...product,
            quantity: item.quantity,
            selectedSize: item.selectedSize || undefined,
            selectedColor: item.selectedColor || undefined,
          });

          return acc;
        }, []);

        const nextWishlist: Product[] = wishlistData
          .map((item: any) => productsById.get(item.productId))
          .filter((product): product is Product => Boolean(product));

        if (isCancelled) return;

        skipNextCartSyncRef.current = true;
        skipNextWishlistSyncRef.current = true;
        setItems(nextItems);
        setWishlist(nextWishlist);

        hydratedUserIdRef.current = user.id;
      } catch (error) {
        console.error('Failed to hydrate cart/wishlist from Firestore:', error);
        if (!isCancelled) {
          hydratedUserIdRef.current = user.id;
        }
      }
    };

    void hydrateFromFirestore();

    return () => {
      isCancelled = true;
    };
  }, [authLoading, isLoggedIn, isFirebaseReady, user]);

  useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn) return;

    writeGuestCart(items);
  }, [authLoading, isLoggedIn, items]);

  useEffect(() => {
    if (authLoading) return;
    if (isLoggedIn) return;

    writeGuestWishlist(wishlist);
  }, [authLoading, isLoggedIn, wishlist]);

  useEffect(() => {
    if (authLoading || !isLoggedIn || !user || !isFirebaseReady) return;
    if (hydratedUserIdRef.current !== user.id) return;

    if (skipNextCartSyncRef.current) {
      skipNextCartSyncRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const db = getFirestore_();
          const remoteItems = await loadCartItems(user.id);
          const batch = writeBatch(db);

          // Delete all existing remote items in a single batch
          for (const remoteItem of remoteItems) {
            batch.delete(doc(db, 'cartItems', remoteItem.id));
          }

          // Add all current local items in the same batch
          for (const item of items) {
            const newRef = doc(collection(db, 'cartItems'));
            batch.set(newRef, {
              userId: user.id,
              productId: item.id,
              quantity: item.quantity,
              selectedSize: item.selectedSize || '',
              selectedColor: item.selectedColor || '',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Single atomic write instead of N sequential writes
          await batch.commit();
        } catch (error) {
          console.error('Failed to sync cart to Firestore:', error);
        }
      })();
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authLoading, isLoggedIn, isFirebaseReady, items, user]);

  useEffect(() => {
    if (authLoading || !isLoggedIn || !user || !isFirebaseReady) return;
    if (hydratedUserIdRef.current !== user.id) return;

    if (skipNextWishlistSyncRef.current) {
      skipNextWishlistSyncRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          if (wishlist.length === 0) return;

          // Add each wishlist item to Firestore
          for (const product of wishlist) {
            await addWishlistItem(user.id, product.id);
          }
        } catch (error) {
          console.error('Failed to sync wishlist to Firestore:', error);
        }
      })();
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authLoading, isLoggedIn, isFirebaseReady, user, wishlist]);

  const addToCart = useCallback((product: Product, quantity = 1, size?: string, color?: string) => {
    setItems((prev) => {
      const nextItemKey = buildCartItemKey(product.id, size, color);
      const existingItem = prev.find((item) =>
        buildCartItemKey(item.id, item.selectedSize, item.selectedColor) === nextItemKey,
      );

      if (existingItem) {
        return prev.map((item) =>
          buildCartItemKey(item.id, item.selectedSize, item.selectedColor) === nextItemKey
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }

      return [...prev, { ...product, quantity, selectedSize: size, selectedColor: color }];
    });
    setIsCartOpen(true);

    void trackRecommendationEvent('add_to_cart', product.id, {
      quantity,
      selectedSize: size || null,
      selectedColor: color || null,
    });
  }, []);

  const removeFromCart = useCallback((productId: string, size?: string, color?: string) => {
    const normalizedProductId = String(productId || '').trim();
    const hasVariantScope = Boolean(normalizeVariantValue(size) || normalizeVariantValue(color));

    setItems((prev) => {
      if (!hasVariantScope) {
        return prev.filter((item) => item.id !== normalizedProductId);
      }

      const targetKey = buildCartItemKey(normalizedProductId, size, color);
      return prev.filter(
        (item) => buildCartItemKey(item.id, item.selectedSize, item.selectedColor) !== targetKey,
      );
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, size?: string, color?: string) => {
    const normalizedProductId = String(productId || '').trim();
    const hasVariantScope = Boolean(normalizeVariantValue(size) || normalizeVariantValue(color));

    const isTargetItem = (item: CartItem) => {
      if (!hasVariantScope) {
        return item.id === normalizedProductId;
      }

      return (
        buildCartItemKey(item.id, item.selectedSize, item.selectedColor)
        === buildCartItemKey(normalizedProductId, size, color)
      );
    };

    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => !isTargetItem(item)));
      return;
    }

    setItems((prev) => prev.map((item) => (isTargetItem(item) ? { ...item, quantity } : item)));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);

    if (!isLoggedIn || !user || !isFirebaseReady) return;

    void (async () => {
      try {
        const remoteItems = await loadCartItems(user.id);

        for (const item of remoteItems) {
          await deleteCartItem(item.id);
        }
      } catch (error) {
        console.error('Failed to clear cart from Firestore:', error);
      }
    })();
  }, [isFirebaseReady, isLoggedIn, user]);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);

  const addToWishlist = useCallback((product: Product) => {
    const alreadyInWishlist = wishlist.some((item) => item.id === product.id);
    if (alreadyInWishlist) return;

    setWishlist((prev) => [...prev, product]);
    void trackRecommendationEvent('add_to_wishlist', product.id);
  }, [wishlist]);

  const removeFromWishlist = useCallback((productId: string) => {
    setWishlist((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const isInWishlist = useCallback((productId: string) => wishlist.some((item) => item.id === productId), [wishlist]);
  const isInCart = useCallback((productId: string) => items.some((item) => item.id === productId), [items]);

  const addToRecentlyViewed = useCallback((product: Product) => {
    setRecentlyViewed((prev) => [product, ...prev.filter((item) => item.id !== product.id)].slice(0, 10));
  }, []);

  const cartTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items, wishlist, isCartOpen, addToCart, removeFromCart, updateQuantity,
        clearCart, toggleCart, addToWishlist, removeFromWishlist, isInWishlist,
        isInCart, cartTotal, cartCount, recentlyViewed, addToRecentlyViewed,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
