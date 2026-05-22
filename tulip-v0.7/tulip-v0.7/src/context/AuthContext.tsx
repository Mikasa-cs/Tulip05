import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { 
  getAuth_, 
  onAuthStateChange, 
  signOut as firebaseSignOut,
  isFirebaseConfigured, 
  getFirebaseConfigError 
} from '@/lib/firebase';
import { 
  loadUserProfile, 
  createUserProfile, 
  updateUserProfileFirestore, 
  loadAddresses,
  saveAddresses,
  signUpWithEmail,
  signInWithEmail,
} from '@/lib/firestore-service';
import type { AppRole } from '@/lib/database.types';

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  gender?: string;
  phone?: string;
  avatar?: string;
  joinedDate: string;
  address?: string;
  city?: string;
  pincode?: string;
  addresses?: SavedAddress[];
}

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isFirebaseReady: boolean;
  error: string | null;
  signIn: (payload: { email: string; password: string; requireAdmin?: boolean }) => Promise<void>;
  signUp: (payload: { name: string; email: string; password: string; gender?: string }) => Promise<{ requiresEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const formatJoinedDate = (joinedAt: number) =>
  new Date(joinedAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const normalizeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong. Please try again.';
};

const ADMIN_BOOTSTRAP_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim().toLowerCase() || '';
const ADMIN_BOOTSTRAP_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined)?.trim() || '';
const ADMIN_BOOTSTRAP_NAME = (import.meta.env.VITE_ADMIN_NAME as string | undefined)?.trim() || 'Tulip Admin';

const isAdminBootstrapCredentialMatch = (email: string, password: string, requireAdmin: boolean) =>
  requireAdmin &&
  email === ADMIN_BOOTSTRAP_EMAIL &&
  password === ADMIN_BOOTSTRAP_PASSWORD;

const isMissingFirebaseUserError = (error: unknown) => {
  const message = normalizeError(error).toLowerCase();
  return (
    message.includes('auth/user-not-found') ||
    message.includes('auth/invalid-credential') ||
    message.includes('invalid-login-credentials')
  );
};

const toAuthRecoveryMessage = (error: unknown): string => {
  const message = normalizeError(error);

  if (/jwt|token|refresh|session|unauthorized|401|403/i.test(message)) {
    return 'Your login session expired. Please log in again.';
  }

  if (/profile|permission|policy|rls|forbidden|not found/i.test(message)) {
    return 'Unable to load your profile right now. Please log in again and retry.';
  }

  if (/auth\/user-not-found|auth\/wrong-password|auth\/invalid-email/i.test(message)) {
    return 'Invalid email or password.';
  }

  return message;
};

const toUserProfile = (firebaseUser: FirebaseUser, firestoreData: any, addresses: any[]): UserProfile => {
  const joinedAtMs = firestoreData?.joinedAt?.toMillis?.() || Date.now();
  
  return {
    id: firebaseUser.uid,
    name: firestoreData?.fullName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    email: firebaseUser.email || '',
    role: firestoreData?.role || 'customer',
    gender: firestoreData?.gender || undefined,
    phone: firestoreData?.phone || undefined,
    avatar: firestoreData?.avatarUrl || firebaseUser.photoURL || undefined,
    joinedDate: formatJoinedDate(joinedAtMs),
    address: firestoreData?.address || undefined,
    city: firestoreData?.city || undefined,
    pincode: firestoreData?.pincode || undefined,
    addresses: addresses.map((item) => ({
      id: item.id,
      label: item.label,
      address: item.address,
      city: item.city,
      pincode: item.pincode,
      isDefault: item.isDefault,
    })),
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hydrateUser = useCallback(async (authUser: FirebaseUser) => {
    try {
      let profile = await loadUserProfile(authUser.uid);

      if (!profile) {
        // Create profile if it doesn't exist
        const displayName = authUser.displayName || authUser.email?.split('@')[0] || 'User';
        profile = await createUserProfile(
          authUser.uid,
          authUser.email || '',
          displayName,
          null // gender
        );
      }

      const addresses = await loadAddresses(authUser.uid);
      const nextUser = toUserProfile(authUser, profile, addresses);
      setUser(nextUser);
      setError(null);

      return nextUser;
    } catch (err) {
      throw new Error(toAuthRecoveryMessage(err));
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoading(false);
      setError(getFirebaseConfigError());
      return;
    }

    let isCancelled = false;

    const unsubscribe = onAuthStateChange(async (authUser) => {
      try {
        if (!authUser) {
          if (!isCancelled) {
            setUser(null);
            setError(null);
            setIsLoading(false);
          }
          return;
        }

        if (!isCancelled) {
          setIsLoading(true);
        }

        await hydrateUser(authUser);

        if (!isCancelled) {
          setIsLoading(false);
        }
      } catch (authError) {
        if (!isCancelled) {
          setUser(null);
          setError(toAuthRecoveryMessage(authError));
          setIsLoading(false);
        }
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [hydrateUser]);

  const signIn = useCallback<AuthContextType['signIn']>(
    async ({ email, password, requireAdmin = false }) => {
      if (!isFirebaseConfigured) {
        throw new Error(getFirebaseConfigError() || 'Firebase is not configured.');
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('Email is required.');
      }

      setIsLoading(true);
      setError(null);

      try {
        let authUser;

        try {
          authUser = await signInWithEmail(normalizedEmail, password);
        } catch (signInError) {
          if (!isAdminBootstrapCredentialMatch(normalizedEmail, password, requireAdmin) || !isMissingFirebaseUserError(signInError)) {
            throw signInError;
          }

          try {
            authUser = await signUpWithEmail(normalizedEmail, password, ADMIN_BOOTSTRAP_NAME);
          } catch (bootstrapError) {
            const bootstrapMessage = normalizeError(bootstrapError).toLowerCase();
            if (bootstrapMessage.includes('auth/email-already-in-use')) {
              throw new Error('Admin account already exists with a different password. Reset the password in Firebase Authentication, then try again.');
            }
            throw bootstrapError;
          }
        }

        if (isAdminBootstrapCredentialMatch(normalizedEmail, password, requireAdmin)) {
          const existingProfile = await loadUserProfile(authUser.uid);
          if (!existingProfile) {
            await createUserProfile(authUser.uid, normalizedEmail, ADMIN_BOOTSTRAP_NAME, null);
          }

          if (existingProfile?.role !== 'admin') {
            await updateUserProfileFirestore(authUser.uid, { role: 'admin' });
          }
        }

        const signedInUser = await hydrateUser(authUser);

        if (requireAdmin && signedInUser.role !== 'admin') {
          await firebaseSignOut();
          setUser(null);
          throw new Error('This account does not have admin access.');
        }
      } catch (signInError) {
        const message = normalizeError(signInError);
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [hydrateUser],
  );

  const signUp = useCallback<AuthContextType['signUp']>(
    async ({ name, email, password, gender }) => {
      if (!isFirebaseConfigured) {
        throw new Error(getFirebaseConfigError() || 'Firebase is not configured.');
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('Email is required.');
      }

      setIsLoading(true);
      setError(null);

      try {
        const authUser = await signUpWithEmail(normalizedEmail, password, name);

        // Create profile in Firestore
        await createUserProfile(authUser.uid, normalizedEmail, name, gender || null);

        // Note: Firebase Auth doesn't require email confirmation by default
        // If you need it, set it up in Firebase Console
        await hydrateUser(authUser);

        return { requiresEmailConfirmation: false };
      } catch (signUpError) {
        const message = normalizeError(signUpError);
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [hydrateUser],
  );

  const logout = useCallback<AuthContextType['logout']>(async () => {
    if (!isFirebaseConfigured) {
      setUser(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await firebaseSignOut();
      setUser(null);
    } catch (logoutError) {
      const message = normalizeError(logoutError);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback<AuthContextType['updateProfile']>(
    async (updates) => {
      if (!isFirebaseConfigured) {
        throw new Error(getFirebaseConfigError() || 'Firebase is not configured.');
      }
      if (!user) {
        throw new Error('You must be logged in to update profile.');
      }

      setIsLoading(true);
      setError(null);

      try {
        const updateData: any = {};

        if (typeof updates.name === 'string') updateData.fullName = updates.name;
        if (typeof updates.phone === 'string') updateData.phone = updates.phone;
        if (typeof updates.gender === 'string') updateData.gender = updates.gender;
        if (typeof updates.avatar === 'string') updateData.avatarUrl = updates.avatar;
        if (typeof updates.address === 'string') updateData.address = updates.address;
        if (typeof updates.city === 'string') updateData.city = updates.city;
        if (typeof updates.pincode === 'string') updateData.pincode = updates.pincode;

        if (Object.keys(updateData).length > 0) {
          await updateUserProfileFirestore(user.id, updateData);
        }

        if (updates.addresses) {
          await saveAddresses(
            user.id,
            updates.addresses.map((addr) => ({
              id: addr.id,
              label: addr.label,
              address: addr.address,
              city: addr.city,
              pincode: addr.pincode,
              isDefault: addr.isDefault,
            }))
          );
        }

        const auth = getAuth_();
        const currentAuthUser = auth.currentUser;
        if (!currentAuthUser) throw new Error('Unable to reload profile.');

        await hydrateUser(currentAuthUser);
      } catch (updateError) {
        const message = normalizeError(updateError);
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [hydrateUser, user],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        isFirebaseReady: isFirebaseConfigured,
        error,
        signIn,
        signUp,
        logout,
        updateProfile,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
