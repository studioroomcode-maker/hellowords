import { create } from 'zustand';
import { AuthUser, subscribeToAuthState, signOut as authSignOut } from '../services/auth';
import { checkIsSuperAdmin } from '../services/localData';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  isSuperAdmin: boolean;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: true,
  isSuperAdmin: false,

  setUser: (user) => set({
    user,
    isLoading: false,
    isSuperAdmin: checkIsSuperAdmin(user?.email ?? null),
  }),

  setLoading: (isLoading) => set({ isLoading }),

  signOut: async () => {
    try {
      await authSignOut();
      set({ user: null, isSuperAdmin: false });
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  initialize: () => {
    const unsubscribe = subscribeToAuthState((user) => {
      set({
        user,
        isLoading: false,
        isInitialized: true,
        isSuperAdmin: checkIsSuperAdmin(user?.email ?? null),
      });
    });
    return unsubscribe;
  },
}));
