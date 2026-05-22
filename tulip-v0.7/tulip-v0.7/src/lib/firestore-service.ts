import {
  getFirestore_,
  getDatabase_,
  getAuth_,
} from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Query,
  QueryConstraint,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import {
  ref,
  get,
  set,
  update,
  remove,
  DatabaseReference,
} from 'firebase/database';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile as updateFirebaseProfile } from 'firebase/auth';
import type { AppRole } from '@/lib/database.types';

// ===== Type Definitions =====
export interface FirestoreProfile {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  gender: string | null;
  avatarUrl: string | null;
  role: AppRole;
  joinedAt: Timestamp;
  address: string | null;
  city: string | null;
  pincode: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreAddress {
  id: string;
  userId: string;
  label: string;
  address: string;
  city: string;
  pincode: string;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const toMillis = (value: unknown): number => {
  if (!value) return 0;

  if (typeof value === 'number') return value;

  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

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

// ===== Profile Operations =====
export const loadUserProfile = async (userId: string): Promise<FirestoreProfile | null> => {
  const db = getFirestore_();
  const profileRef = doc(db, 'profiles', userId);
  const profileSnap = await getDoc(profileRef);
  
  if (!profileSnap.exists()) {
    return null;
  }

  return profileSnap.data() as FirestoreProfile;
};

export const createUserProfile = async (
  userId: string,
  email: string,
  fullName: string | null,
  gender: string | null
): Promise<FirestoreProfile> => {
  const db = getFirestore_();
  const now = Timestamp.now();

  const profile: FirestoreProfile = {
    id: userId,
    email,
    fullName,
    phone: null,
    gender,
    avatarUrl: null,
    role: 'customer',
    joinedAt: now,
    address: null,
    city: null,
    pincode: null,
    createdAt: now,
    updatedAt: now,
  };

  const profileRef = doc(db, 'profiles', userId);
  await setDoc(profileRef, profile);

  return profile;
};

export const updateUserProfileFirestore = async (
  userId: string,
  updates: Partial<FirestoreProfile>
): Promise<void> => {
  const db = getFirestore_();
  const profileRef = doc(db, 'profiles', userId);
  
  await updateDoc(profileRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// ===== Address Operations =====
export const loadAddresses = async (userId: string): Promise<FirestoreAddress[]> => {
  try {
    const db = getFirestore_();
    const addressesQuery = query(
      collection(db, 'addresses'),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(addressesQuery);
    const addresses = snapshot.docs.map((doc) => doc.data() as FirestoreAddress);
    
    // Sort in client-side to avoid composite index requirement
    return addresses.sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0);
      }
      return toMillis(b.createdAt) - toMillis(a.createdAt);
    });
  } catch (error) {
    // If addresses query fails, return empty array and continue login
    console.warn('Failed to load addresses:', error);
    return [];
  }
};

export const saveAddresses = async (
  userId: string,
  addresses: Array<{
    id?: string;
    label: string;
    address: string;
    city: string;
    pincode: string;
    isDefault?: boolean;
  }>
): Promise<void> => {
  const db = getFirestore_();
  const now = Timestamp.now();

  // Delete all old addresses
  const oldAddresses = await loadAddresses(userId);
  for (const addr of oldAddresses) {
    const addrRef = doc(db, 'addresses', addr.id);
    await deleteDoc(addrRef);
  }

  // Find default address index
  const defaultIndex = Math.max(
    addresses.findIndex((a) => a.isDefault),
    0
  );

  // Create new addresses
  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    const addrId = addr.id || doc(collection(db, 'addresses')).id;

    const firestoreAddr: FirestoreAddress = {
      id: addrId,
      userId,
      label: addr.label,
      address: addr.address,
      city: addr.city,
      pincode: addr.pincode,
      isDefault: i === defaultIndex,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'addresses', addrId), firestoreAddr);
  }
};

// ===== Product Operations (read-only for users) =====
export const loadProduct = async (productId: string): Promise<Record<string, unknown> | null> => {
  const db = getFirestore_();
  const productRef = doc(db, 'products', productId);
  const productSnap = await getDoc(productRef);

  if (!productSnap.exists()) {
    return null;
  }

  return productSnap.data();
};

// ===== Cart Operations (Firestore) =====
export const loadCartItems = async (userId: string) => {
  const db = getFirestore_();
  const cartQuery = query(
    collection(db, 'cartItems'),
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(cartQuery);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

export const addCartItem = async (
  userId: string,
  productId: string,
  quantity: number,
  selectedSize: string,
  selectedColor: string
) => {
  const db = getFirestore_();
  const cartItemRef = doc(collection(db, 'cartItems'));

  await setDoc(cartItemRef, {
    userId,
    productId,
    quantity,
    selectedSize,
    selectedColor,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return cartItemRef.id;
};

export const updateCartItem = async (cartItemId: string, updates: Partial<{
  quantity: number;
  selectedSize: string;
  selectedColor: string;
}>) => {
  const db = getFirestore_();
  const cartItemRef = doc(db, 'cartItems', cartItemId);
  await updateDoc(cartItemRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteCartItem = async (cartItemId: string) => {
  const db = getFirestore_();
  const cartItemRef = doc(db, 'cartItems', cartItemId);
  await deleteDoc(cartItemRef);
};

// ===== Wishlist Operations (Firestore) =====
export const loadWishlistItems = async (userId: string) => {
  const db = getFirestore_();
  const wishlistQuery = query(
    collection(db, 'wishlistItems'),
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(wishlistQuery);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

export const addWishlistItem = async (userId: string, productId: string) => {
  const db = getFirestore_();
  const wishlistRef = doc(collection(db, 'wishlistItems'));

  await setDoc(wishlistRef, {
    userId,
    productId,
    createdAt: Timestamp.now(),
  });

  return wishlistRef.id;
};

export const deleteWishlistItem = async (wishlistItemId: string) => {
  const db = getFirestore_();
  const wishlistRef = doc(db, 'wishlistItems', wishlistItemId);
  await deleteDoc(wishlistRef);
};

// ===== Order Operations (Firestore) =====
export const createOrder = async (
  userId: string,
  totalAmount: number,
  shippingDetails: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    pincode: string;
  }
) => {
  const db = getFirestore_();
  const ordersRef = doc(collection(db, 'orders'));
  const now = Timestamp.now();

  const orderData = {
    userId,
    status: 'processing',
    totalAmount,
    currency: 'INR',
    shippingName: shippingDetails.name,
    shippingEmail: shippingDetails.email,
    shippingPhone: shippingDetails.phone,
    shippingAddress: shippingDetails.address,
    shippingCity: shippingDetails.city,
    shippingPincode: shippingDetails.pincode,
    notes: null,
    paymentGateway: 'stripe',
    paymentStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ordersRef, orderData);
  return ordersRef.id;
};

export const addOrderItems = async (orderId: string, items: Array<{
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}>) => {
  const db = getFirestore_();
  const orderItemsRef = collection(db, 'orders', orderId, 'items');

  for (const item of items) {
    const itemRef = doc(orderItemsRef);
    await setDoc(itemRef, {
      ...item,
      createdAt: Timestamp.now(),
    });
  }
};

export const loadOrders = async (userId: string) => {
  try {
    const db = getFirestore_();
    const ordersQuery = query(
      collection(db, 'orders'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(ordersQuery);
    const orders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{ id: string; createdAt?: unknown }>;
    
    // Sort client-side to avoid composite index requirement
    return orders.sort((a, b) => {
      const aTime = toMillis(a.createdAt);
      const bTime = toMillis(b.createdAt);
      return bTime - aTime; // Descending order
    });
  } catch (error) {
    console.warn('Failed to load orders:', error);
    return [];
  }
};

export const loadOrder = async (orderId: string) => {
  const db = getFirestore_();
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    return null;
  }

  return {
    id: orderSnap.id,
    ...orderSnap.data(),
  };
};

// ===== Chat Operations (Realtime Database) =====
export const loadChatRooms = async (): Promise<any[]> => {
  const db = getDatabase_();
  const roomsRef = ref(db, 'chatRooms');
  const snapshot = await get(roomsRef);

  if (!snapshot.exists()) {
    return [];
  }

  const data = snapshot.val();
  return Object.entries(data).map(([id, room]: [string, any]) => ({
    id,
    ...room,
  }));
};

export const loadChatMessages = async (roomId: string): Promise<any[]> => {
  const db = getDatabase_();
  const messagesRef = ref(db, `chatRooms/${roomId}/messages`);
  const snapshot = await get(messagesRef);

  if (!snapshot.exists()) {
    return [];
  }

  const data = snapshot.val();
  return Object.entries(data)
    .map(([id, msg]: [string, any]) => ({
      id,
      ...msg,
    }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
};

export const sendChatMessage = async (
  roomId: string,
  userId: string,
  content: string,
  messageType: string = 'text',
  metadata?: any
) => {
  const db = getDatabase_();
  const messageRef = doc(collection(getFirestore_(), 'chatMessages'));
  const messageId = messageRef.id;

  const messageData = {
    roomId,
    userId,
    content,
    messageType,
    metadata: metadata || null,
    createdAt: Date.now(),
  };

  const rtDbRef = ref(db, `chatRooms/${roomId}/messages/${messageId}`);
  await set(rtDbRef, messageData);

  return messageId;
};

// ===== Recommendation Events (Firestore) =====
export const recordRecommendationEvent = async (
  userId: string,
  eventType: string,
  productId?: string,
  metadata?: any
) => {
  const db = getFirestore_();
  const eventsRef = doc(collection(db, 'recommendationEvents'));

  await setDoc(eventsRef, {
    userId,
    eventType,
    productId: productId || null,
    metadata: metadata || null,
    createdAt: Timestamp.now(),
  });

  return eventsRef.id;
};

// ===== Auth Service =====
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string
) => {
  const auth = getAuth_();
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  // Update Firebase Auth profile
  if (userCredential.user) {
    await updateFirebaseProfile(userCredential.user, {
      displayName,
    });
  }

  return userCredential.user;
};

export const signInWithEmail = async (email: string, password: string) => {
  const auth = getAuth_();
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};
