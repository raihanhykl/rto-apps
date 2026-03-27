import { create } from 'zustand';
import { api } from '@/lib/api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.login(username, password);
      // Token is stored in memory by api.login() already
      set({ user: result.user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // ignore — logout clears token in api.ts finally block
    }
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    // First check if we have a token in memory
    if (api.getToken()) {
      try {
        const result = await api.getMe();
        set({ user: result.user, isAuthenticated: true, isLoading: false });
        return;
      } catch {
        // Token invalid — fall through to try refresh
      }
    }

    // No in-memory token — try refresh via httpOnly cookie
    const refreshed = await api.refreshToken();
    if (refreshed) {
      try {
        const result = await api.getMe();
        set({ user: result.user, isAuthenticated: true, isLoading: false });
        return;
      } catch {
        // Still failed after refresh
      }
    }

    api.setToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  clearError: () => set({ error: null }),
}));
