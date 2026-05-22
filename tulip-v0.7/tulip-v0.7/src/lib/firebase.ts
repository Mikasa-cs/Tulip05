import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  Auth,
  connectAuthEmulator,
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import {
  getDatabase,
  Database,
  connectDatabaseEmulator,
} from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.authDomain && 
  firebaseConfig.projectId
);

export const getFirebaseConfigError = (): string | null => {
  if (isFirebaseConfigured) return null;
  return 'Firebase is not configured. Add VITE_FIREBASE_* to your environment.';
};

// Initialize Firebase
let firebaseApp = initializeApp(firebaseConfig);
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let realtimeDbInstance: Database | null = null;

// Get Auth instance (singleton)
export const getAuth_ = (): Auth => {
  const configError = getFirebaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  if (!authInstance) {
    authInstance = getAuth(firebaseApp);
    
    // Enable emulator if VITE_FIREBASE_EMULATOR is set
    if (import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true') {
      try {
        connectAuthEmulator(authInstance, 'http://localhost:9099');
      } catch (e) {
        // Already connected or not needed
      }
    }
  }

  return authInstance;
};

// Get Firestore instance (singleton)
export const getFirestore_ = (): Firestore => {
  const configError = getFirebaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  if (!firestoreInstance) {
    firestoreInstance = getFirestore(firebaseApp);
    
    // Enable emulator if VITE_FIREBASE_EMULATOR is set
    if (import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true') {
      try {
        connectFirestoreEmulator(firestoreInstance, 'localhost', 8080);
      } catch (e) {
        // Already connected or not needed
      }
    }
  }

  return firestoreInstance;
};

// Get Realtime Database instance (singleton)
export const getDatabase_ = (): Database => {
  const configError = getFirebaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  if (!realtimeDbInstance) {
    realtimeDbInstance = getDatabase(firebaseApp);
    
    // Enable emulator if VITE_FIREBASE_EMULATOR is set
    if (import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true') {
      try {
        connectDatabaseEmulator(realtimeDbInstance, 'localhost', 9000);
      } catch (e) {
        // Already connected or not needed
      }
    }
  }

  return realtimeDbInstance;
};

// Auth state listener helper
export const onAuthStateChange = (
  callback: (user: User | null) => void
): (() => void) => {
  const auth = getAuth_();
  return onAuthStateChanged(auth, callback);
};

// Sign out helper
export const signOut = async (): Promise<void> => {
  const auth = getAuth_();
  await firebaseSignOut(auth);
};

// Get current user
export const getCurrentUser = (): User | null => {
  const auth = getAuth_();
  return auth.currentUser;
};
