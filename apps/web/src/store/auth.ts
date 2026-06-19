import { create } from 'zustand';
import { api, setAccessToken, ApiClientError } from '@/lib/api';

export type Role = 'ADMIN' | 'ORGANIZER' | 'PLAYER';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  staticId: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  register: (data: { username: string; email: string; password: string; staticId: string }) => Promise<void>;
  login: (data: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ user: User; accessToken: string }>('/auth/register', data, { auth: false });
      setAccessToken(res.accessToken);
      set({ user: res.user, isLoading: false });
    } catch (e) {
      const message = e instanceof ApiClientError ? e.message : 'Не удалось создать аккаунт';
      set({ error: message, isLoading: false });
      throw e;
    }
  },

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<{ user: User; accessToken: string }>('/auth/login', data, { auth: false });
      setAccessToken(res.accessToken);
      set({ user: res.user, isLoading: false });
    } catch (e) {
      const message = e instanceof ApiClientError ? e.message : 'Не удалось войти';
      set({ error: message, isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    await api.post('/auth/logout', undefined, { auth: false }).catch(() => {});
    setAccessToken(null);
    set({ user: null });
  },

  fetchMe: async () => {
    try {
      const user = await api.get<User>('/auth/me');
      set({ user, isInitialized: true });
    } catch {
      set({ user: null, isInitialized: true });
    }
  },

  clearError: () => set({ error: null }),
}));
