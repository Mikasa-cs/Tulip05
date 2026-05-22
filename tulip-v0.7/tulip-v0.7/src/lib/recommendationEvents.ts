import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export type RecommendationEventType = 'view_product' | 'add_to_cart' | 'add_to_wishlist';

export const trackRecommendationEvent = async (
  eventType: RecommendationEventType,
  productId: string,
  eventMetadata: Record<string, unknown> = {},
) => {
  if (!productId.trim()) {
    return;
  }

  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    const firestore = getFirestore();
    const eventsRef = collection(firestore, 'recommendationEvents');
    
    await addDoc(eventsRef, {
      userId: user.uid,
      productId: productId.trim(),
      eventType,
      eventMetadata,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Silently fail - recommendation tracking is non-critical
  }
};
