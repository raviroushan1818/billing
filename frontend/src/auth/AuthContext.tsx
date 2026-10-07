import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AuthUser,
  clearAuth,
  getStoredToken,
  getStoredUser,
  storeAuth,
} from '../api/client';
import { authApi } from '../api';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (
    clientId: string,
    email: string,
    password: string,
  ) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .me()
      .then((me) => {
        storeAuth(token, me);
        setUser(me);
      })
      .catch(() => {
        clearAuth();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('billing:unauthorized', onUnauthorized);
    return () =>
      window.removeEventListener('billing:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(
    async (clientId: string, email: string, password: string) => {
      const res = await authApi.login(clientId, email, password);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return null;
    }
    try {
      const me = await authApi.me();
      storeAuth(token, me);
      setUser(me);
      return me;
    } catch {
      clearAuth();
      setUser(null);
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
