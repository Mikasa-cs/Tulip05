import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, setDoc, doc, getDoc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { products as catalogProducts } from '@/data/products';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ChatMessageType = 'text' | 'product_share' | 'review';

type MessageMetadata = Record<string, unknown>;

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string;
  image: string;
  price: number;
}

export interface ChatRoom {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
}

export interface ChatRoomListItem extends ChatRoom {
  displayName: string;
  peerUserId: string | null;
  peerName: string | null;
  lastMessageAt: string | null;
}

export interface ChatMemberCandidate {
  userId: string;
  displayName: string;
  email: string;
}

export interface ChatMessageItem {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  messageType: ChatMessageType;
  content: string;
  metadata: MessageMetadata;
  createdAt: string;
}

export interface ProductReviewItem {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  reviewText: string;
  roomId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Caches ────────────────────────────────────────────────────────────────────

const catalogProductCache = new Map<string, CatalogProduct>();
const profileNameCache = new Map<string, string>();

// ─── Helpers ───────────────────────────────────────────────────────────────────

const normalizeErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown; details?: unknown; hint?: unknown };
    const message = typeof maybeError.message === 'string' ? maybeError.message.trim() : '';
    const details = typeof maybeError.details === 'string' ? maybeError.details.trim() : '';
    const hint = typeof maybeError.hint === 'string' ? maybeError.hint.trim() : '';

    if (message && details) return `${message} (${details})`;
    if (message && hint) return `${message} (${hint})`;
    if (message) return message;
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;

  return fallback;
};

const upsertRoomMembership = async (roomId: string, userId: string): Promise<void> => {
  const normalizedRoomId = String(roomId || '').trim();
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedRoomId || !normalizedUserId) return;

  const firestore = getFirestore();
  const membershipId = `${normalizedRoomId}_${normalizedUserId}`;
  const membershipRef = doc(firestore, 'chatRoomMembers', membershipId);

  const existingMembership = await getDoc(membershipRef);
  if (existingMembership.exists()) return;

  const now = new Date().toISOString();

  await setDoc(membershipRef, {
    id: membershipId,
    roomId: normalizedRoomId,
    userId: normalizedUserId,
    joinedAt: now,
    updatedAt: now,
  });
};

const touchRoomActivity = async (roomId: string): Promise<void> => {
  const normalizedRoomId = String(roomId || '').trim();
  if (!normalizedRoomId) return;

  const firestore = getFirestore();
  const now = new Date().toISOString();

  try {
    await setDoc(
      doc(firestore, 'chatRooms', normalizedRoomId),
      { lastMessageAt: now, updatedAt: now },
      { merge: true },
    );
  } catch {
    // Non-admin users may not have update access to chatRooms
  }
};

const getProfileNames = async (userIds: string[]): Promise<Map<string, string>> => {
  const nextMap = new Map<string, string>();
  if (userIds.length === 0) return nextMap;

  try {
    const firestore = getFirestore();
    const missingUserIds = userIds.filter((userId) => {
      const cachedName = profileNameCache.get(userId);
      if (!cachedName) return true;
      nextMap.set(userId, cachedName);
      return false;
    });

    if (missingUserIds.length === 0) return nextMap;

    // Firestore 'in' queries support max 30 values
    const batches = [];
    for (let i = 0; i < missingUserIds.length; i += 30) {
      batches.push(missingUserIds.slice(i, i + 30));
    }

    const profilesRef = collection(firestore, 'profiles');
    for (const batch of batches) {
      const profilesSnapshot = await getDocs(query(profilesRef, where('id', 'in', batch)));

      for (const profileDoc of profilesSnapshot.docs) {
        const data = profileDoc.data();
        const fallbackName = data.email?.split('@')[0] || 'User';
        const displayName = data.fullName?.trim() || fallbackName;
        const userId = data.id || profileDoc.id;
        nextMap.set(userId, displayName);
        profileNameCache.set(userId, displayName);
      }
    }
  } catch {
    // Return cached/partial results
  }

  return nextMap;
};

const getUserName = async (userId: string): Promise<string> => {
  try {
    const firestore = getFirestore();
    const profileDoc = await getDoc(doc(firestore, 'profiles', userId));
    if (profileDoc.exists()) {
      const data = profileDoc.data();
      return data.fullName || data.email?.split('@')[0] || 'User';
    }
  } catch {
    // Use default name
  }
  return 'User';
};

// ─── Catalog Products ──────────────────────────────────────────────────────────

export const getCatalogProduct = async (productId: string): Promise<CatalogProduct | null> => {
  const normalizedProductId = String(productId || '').trim();
  if (!normalizedProductId) return null;

  const cachedProduct = catalogProductCache.get(normalizedProductId);
  if (cachedProduct) return cachedProduct;

  // First try local products
  const localProduct = catalogProducts.find(p => String(p.id) === normalizedProductId);
  if (localProduct) {
    const mapped: CatalogProduct = {
      id: String(localProduct.id),
      name: localProduct.name,
      brand: localProduct.brand,
      image: localProduct.image || '',
      price: Number(localProduct.price) || 0,
    };
    catalogProductCache.set(mapped.id, mapped);
    return mapped;
  }

  // Then try Firestore
  try {
    const firestore = getFirestore();
    const productDoc = await getDoc(doc(firestore, 'products', normalizedProductId));
    
    if (!productDoc.exists()) return null;

    const data = productDoc.data();
    const mappedProduct: CatalogProduct = {
      id: productDoc.id,
      name: data.name || '',
      brand: data.brand || '',
      image: data.imageUrl || '',
      price: Number(data.price) || 0,
    };
    catalogProductCache.set(mappedProduct.id, mappedProduct);
    return mappedProduct;
  } catch {
    return null;
  }
};

export const searchCatalogProducts = async (
  searchQuery: string,
  searchLimit = 8,
): Promise<CatalogProduct[]> => {
  const safeLimit = Math.min(Math.max(Math.floor(searchLimit), 1), 30);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  // First search local products
  const localResults: CatalogProduct[] = [];
  for (const product of catalogProducts) {
    if (localResults.length >= safeLimit) break;
    const matchesQuery = !normalizedQuery || 
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.brand.toLowerCase().includes(normalizedQuery) ||
      String(product.id).includes(normalizedQuery);
    
    if (matchesQuery) {
      localResults.push({
        id: String(product.id),
        name: product.name,
        brand: product.brand,
        image: product.image || '',
        price: Number(product.price) || 0,
      });
    }
  }

  if (localResults.length >= safeLimit) return localResults;

  // Then try Firestore if needed
  try {
    const firestore = getFirestore();
    const productsRef = collection(firestore, 'products');
    
    const q = normalizedQuery
      ? query(productsRef, limit(safeLimit - localResults.length))
      : query(productsRef, orderBy('isTrending', 'desc'), limit(safeLimit - localResults.length));
    
    const snapshot = await getDocs(q);
    for (const productDoc of snapshot.docs) {
      const data = productDoc.data();
      const matches = !normalizedQuery ||
        (data.name?.toLowerCase().includes(normalizedQuery)) ||
        (data.brand?.toLowerCase().includes(normalizedQuery));
      
      if (matches) {
        localResults.push({
          id: productDoc.id,
          name: data.name || '',
          brand: data.brand || '',
          image: data.imageUrl || '',
          price: Number(data.price) || 0,
        });
      }
      
      if (localResults.length >= safeLimit) break;
    }
  } catch {
    // Return what we have from local search
  }

  return localResults.slice(0, safeLimit);
};

// ─── Chat Rooms ────────────────────────────────────────────────────────────────

export const ensureCommunityChatRoom = async (): Promise<ChatRoom> => {
  try {
    const firestore = getFirestore();
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User must be logged in to join chat.');
    }

    const chatRoomsRef = collection(firestore, 'chatRooms');
    const communityQuery = query(chatRoomsRef, where('slug', '==', 'community'));
    const snapshot = await getDocs(communityQuery);

    if (!snapshot.empty) {
      const roomDoc = snapshot.docs[0];
      const data = roomDoc.data();

      await upsertRoomMembership(roomDoc.id, currentUser.uid);

      return {
        id: roomDoc.id,
        slug: data.slug || 'community',
        name: data.name || 'Community Chat',
        description: data.description || null,
        isPrivate: Boolean(data.isPrivate ?? false),
      };
    }

    const now = new Date().toISOString();
    const newRoomRef = await addDoc(chatRoomsRef, {
      slug: 'community',
      name: 'Community Chat',
      description: 'Join our community to discuss products and share experiences',
      isPrivate: false,
      createdAt: now,
      createdBy: currentUser.uid,
      lastMessageAt: null,
    });

    await upsertRoomMembership(newRoomRef.id, currentUser.uid);

    return {
      id: newRoomRef.id,
      slug: 'community',
      name: 'Community Chat',
      description: 'Join our community to discuss products and share experiences',
      isPrivate: false,
    };
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Unable to join chat room right now.'));
  }
};

export const listMyChatRooms = async (): Promise<ChatRoomListItem[]> => {
  try {
    const firestore = getFirestore();
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) return [];

    // Query only this user's memberships instead of loading all memberships
    const membershipsRef = collection(firestore, 'chatRoomMembers');
    const memberQuery = query(membershipsRef, where('userId', '==', currentUser.uid));
    const memberSnapshot = await getDocs(memberQuery);

    const roomIdSet = new Set<string>();
    for (const membershipDoc of memberSnapshot.docs) {
      const data = membershipDoc.data();
      const roomId = String(data.roomId || '');
      if (roomId) roomIdSet.add(roomId);
    }

    if (roomIdSet.size === 0) {
      const communityRoom = await ensureCommunityChatRoom();
      roomIdSet.add(communityRoom.id);
    }

    const rooms: ChatRoomListItem[] = [];

    for (const roomId of roomIdSet) {
      try {
        const roomDoc = await getDoc(doc(firestore, 'chatRooms', roomId));
        if (roomDoc.exists()) {
          const data = roomDoc.data();
          const isPrivate = Boolean(data.isPrivate ?? false);
          const roomName = String(data.name || (isPrivate ? 'Private Chat' : 'Community Chat'));

          rooms.push({
            id: roomDoc.id,
            slug: String(data.slug || ''),
            name: roomName,
            description: (data.description || null) as string | null,
            isPrivate,
            displayName: roomName,
            peerUserId: null,
            peerName: null,
            lastMessageAt: (data.lastMessageAt || null) as string | null,
          });
        }
      } catch {
        // Skip rooms that can't be loaded
      }
    }

    return rooms.sort((firstRoom, secondRoom) => {
      const firstTime = firstRoom.lastMessageAt ? Date.parse(firstRoom.lastMessageAt) : 0;
      const secondTime = secondRoom.lastMessageAt ? Date.parse(secondRoom.lastMessageAt) : 0;
      return secondTime - firstTime;
    });
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Unable to load your chat rooms.'));
  }
};

export const searchChatMembers = async (
  searchQuery: string,
  searchLimit = 8,
): Promise<ChatMemberCandidate[]> => {
  try {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const safeLimit = Math.min(Math.max(Math.floor(searchLimit), 1), 30);

    if (!normalizedQuery) return [];

    const firestore = getFirestore();
    const profilesRef = collection(firestore, 'profiles');
    const snapshot = await getDocs(query(profilesRef, limit(safeLimit * 3)));

    const results: ChatMemberCandidate[] = [];
    for (const profileDoc of snapshot.docs) {
      const data = profileDoc.data();
      const matchesQuery = 
        (data.fullName?.toLowerCase().includes(normalizedQuery)) ||
        (data.email?.toLowerCase().includes(normalizedQuery));

      if (matchesQuery) {
        results.push({
          userId: data.id || profileDoc.id,
          displayName: data.fullName || data.email?.split('@')[0] || 'User',
          email: data.email || '',
        });

        if (results.length >= safeLimit) break;
      }
    }

    return results;
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Unable to search members right now.'));
  }
};

export const createPrivateChatWithMember = async (memberId: string): Promise<string> => {
  try {
    const normalizedMemberId = memberId.trim();
    if (!normalizedMemberId) {
      throw new Error('A member is required to start private chat.');
    }

    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User must be logged in to create private chat.');
    }

    const firestore = getFirestore();

    // Check for existing private chat between these two users
    const chatRoomsRef = collection(firestore, 'chatRooms');
    const privateRoomsQuery = query(chatRoomsRef, where('isPrivate', '==', true));
    const existingSnapshot = await getDocs(privateRoomsQuery);

    for (const roomDoc of existingSnapshot.docs) {
      const data = roomDoc.data();
      const memberIds = Array.isArray(data.memberIds)
        ? data.memberIds.map((value: unknown) => String(value)).filter(Boolean)
        : [];

      if (memberIds.includes(currentUser.uid) && memberIds.includes(normalizedMemberId)) {
        await Promise.all([
          upsertRoomMembership(roomDoc.id, currentUser.uid),
          upsertRoomMembership(roomDoc.id, normalizedMemberId),
        ]);
        return roomDoc.id;
      }
    }

    const now = new Date().toISOString();
    const newRoomRef = await addDoc(chatRoomsRef, {
      isPrivate: true,
      memberIds: [currentUser.uid, normalizedMemberId],
      name: 'Private Chat',
      createdAt: now,
      createdBy: currentUser.uid,
      lastMessageAt: null,
    });

    await Promise.all([
      upsertRoomMembership(newRoomRef.id, currentUser.uid),
      upsertRoomMembership(newRoomRef.id, normalizedMemberId),
    ]);

    return newRoomRef.id;
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Unable to create private chat.'));
  }
};

// ─── Chat Messages ─────────────────────────────────────────────────────────────

export const listChatMessages = async (roomId: string, msgLimit = 120): Promise<ChatMessageItem[]> => {
  try {
    const safeLimit = Math.min(Math.max(Math.floor(msgLimit), 1), 300);
    const firestore = getFirestore();
    // Use subcollection to avoid composite index requirement
    // chatRooms/{roomId}/messages/{messageId}
    const messagesRef = collection(firestore, 'chatRooms', roomId, 'messages');

    // Single orderBy field on subcollection doesn't require composite index
    const messagesQuery = query(
      messagesRef,
      orderBy('createdAt', 'asc'),
      limit(safeLimit),
    );
    const snapshot = await getDocs(messagesQuery);

    const messages: ChatMessageItem[] = [];
    const userIdSet = new Set<string>();

    for (const snapshotDoc of snapshot.docs) {
      const data = snapshotDoc.data();
      const userId = String(data.userId || '');
      if (userId) userIdSet.add(userId);

      messages.push({
        id: snapshotDoc.id,
        roomId, // Always the current room when querying from subcollection
        userId,
        userName: String(data.userName || 'User'),
        messageType: (data.messageType || 'text') as ChatMessageType,
        content: String(data.content || ''),
        metadata: (data.metadata || {}) as MessageMetadata,
        createdAt: String(data.createdAt || new Date().toISOString()),
      });
    }

    // Enrich user names from cache/profiles
    if (userIdSet.size > 0) {
      const userNames = await getProfileNames([...userIdSet]);
      for (const msg of messages) {
        const name = userNames.get(msg.userId);
        if (name) msg.userName = name;
      }
    }

    return messages;
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Unable to load chat messages.'));
  }
};

export const sendTextMessage = async (roomId: string, userId: string, content: string): Promise<void> => {
  try {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Message cannot be empty.');

    const firestore = getFirestore();
    const userName = await getUserName(userId);
    // Use subcollection for message storage
    const messagesRef = collection(firestore, 'chatRooms', roomId, 'messages');

    await addDoc(messagesRef, {
      userId,
      userName,
      messageType: 'text',
      content: trimmed,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    await touchRoomActivity(roomId);
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Unable to send message.'));
  }
};

export const sendProductShareMessage = async (
  roomId: string,
  userId: string,
  payload: { productId: string; note?: string },
): Promise<void> => {
  try {
    const product = await getCatalogProduct(payload.productId);
    if (!product) throw new Error('Product was not found in catalog.');

    const firestore = getFirestore();
    const userName = await getUserName(userId);

    const metadata: MessageMetadata = {
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      imageUrl: product.image,
      price: product.price,
    };

    // Use subcollection for message storage
    const messagesRef = collection(firestore, 'chatRooms', roomId, 'messages');
    await addDoc(messagesRef, {
      userId,
      userName,
      messageType: 'product_share',
      content: payload.note?.trim() || `Shared ${product.name}`,
      metadata,
      createdAt: new Date().toISOString(),
    });

    await touchRoomActivity(roomId);
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Unable to share product in chat.'));
  }
};

// ─── Product Reviews ───────────────────────────────────────────────────────────

export const upsertProductReview = async (payload: {
  productId: string;
  userId: string;
  rating: number;
  reviewText: string;
  roomId?: string | null;
}): Promise<ProductReviewItem> => {
  try {
    const normalizedRating = Math.min(5, Math.max(1, Math.round(payload.rating)));
    const normalizedReviewText = payload.reviewText.trim();

    const firestore = getFirestore();
    const userName = await getUserName(payload.userId);

    // Use a targeted query instead of loading ALL reviews
    const reviewsRef = collection(firestore, 'productReviews');
    const existingQuery = query(
      reviewsRef,
      where('productId', '==', payload.productId),
      where('userId', '==', payload.userId),
      limit(1),
    );
    const existingSnapshot = await getDocs(existingQuery);

    let reviewDocId: string;
    const now = new Date().toISOString();

    if (!existingSnapshot.empty) {
      reviewDocId = existingSnapshot.docs[0].id;
      await updateDoc(doc(firestore, 'productReviews', reviewDocId), {
        rating: normalizedRating,
        reviewText: normalizedReviewText,
        updatedAt: now,
      });
    } else {
      const ref = await addDoc(reviewsRef, {
        productId: payload.productId,
        userId: payload.userId,
        rating: normalizedRating,
        reviewText: normalizedReviewText,
        roomId: payload.roomId || null,
        createdAt: now,
        updatedAt: now,
      });
      reviewDocId = ref.id;
    }

    return {
      id: reviewDocId,
      productId: payload.productId,
      userId: payload.userId,
      userName,
      rating: normalizedRating,
      reviewText: normalizedReviewText,
      roomId: payload.roomId || null,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Unable to save product review.'));
  }
};

export const sendReviewMessage = async (
  roomId: string,
  userId: string,
  payload: { productId: string; rating: number; reviewText: string; reviewId?: string },
): Promise<void> => {
  try {
    const product = await getCatalogProduct(payload.productId);
    if (!product) throw new Error('Product was not found in catalog.');

    const firestore = getFirestore();
    const userName = await getUserName(userId);

    const metadata: MessageMetadata = {
      reviewId: payload.reviewId || null,
      productId: product.id,
      productName: product.name,
      rating: Math.min(5, Math.max(1, Math.round(payload.rating))),
    };

    // Use subcollection for message storage
    const messagesRef = collection(firestore, 'chatRooms', roomId, 'messages');
    await addDoc(messagesRef, {
      userId,
      userName,
      messageType: 'review',
      content: payload.reviewText.trim(),
      metadata,
      createdAt: new Date().toISOString(),
    });

    await touchRoomActivity(roomId);
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Unable to post review in chat.'));
  }
};

export const listProductReviews = async (productId: string, reviewLimit = 20): Promise<ProductReviewItem[]> => {
  try {
    const safeLimit = Math.min(Math.max(Math.floor(reviewLimit), 1), 100);

    const firestore = getFirestore();
    const reviewsRef = collection(firestore, 'productReviews');

    // Use a Firestore query instead of loading ALL reviews
    const reviewsQuery = query(
      reviewsRef,
      where('productId', '==', productId),
      orderBy('updatedAt', 'desc'),
      limit(safeLimit),
    );
    const snapshot = await getDocs(reviewsQuery);

    const userIdSet = new Set<string>();
    const rawReviews: Array<{ docId: string; data: Record<string, unknown> }> = [];

    for (const reviewDoc of snapshot.docs) {
      const data = reviewDoc.data() as Record<string, unknown>;
      const reviewUserId = String(data.userId || '');
      if (reviewUserId) userIdSet.add(reviewUserId);
      rawReviews.push({ docId: reviewDoc.id, data });
    }

    const userNames = await getProfileNames([...userIdSet]);

    return rawReviews.map(({ docId, data }) => {
      const reviewUserId = String(data.userId || '');
      return {
        id: docId,
        productId: String(data.productId || productId),
        userId: reviewUserId,
        userName: userNames.get(reviewUserId) || 'User',
        rating: Number(data.rating || 0),
        reviewText: String(data.reviewText || ''),
        roomId: (data.roomId || null) as string | null,
        createdAt: String(data.createdAt || new Date().toISOString()),
        updatedAt: String(data.updatedAt || new Date().toISOString()),
      };
    });
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'Unable to load product reviews.'));
  }
};

// ─── Real-time Subscriptions ───────────────────────────────────────────────────

export const subscribeToChatMessages = (
  roomId: string,
  onRefresh: () => Promise<void> | void,
): (() => void) => {
  try {
    const firestore = getFirestore();
    // Use subcollection to listen to room-specific messages
    const messagesRef = collection(firestore, 'chatRooms', roomId, 'messages');

    // No where clause needed since we're already in the room's subcollection
    const roomMessagesQuery = query(messagesRef);

    const unsubscribe = onSnapshot(roomMessagesQuery, () => {
      void onRefresh();
    }, (error) => {
      console.error('Error subscribing to messages:', error);
    });

    return () => {
      unsubscribe();
    };
  } catch (error) {
    console.error('Error setting up subscription:', error);
    return () => undefined;
  }
};