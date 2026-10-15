import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { User } from './types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clearSession = () => setUser(null);
    window.addEventListener('retain-session-expired', clearSession);
    return () => window.removeEventListener('retain-session-expired', clearSession);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('retain_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api<{ user: User }>('/auth/me')
      .then((data) => {
        if (localStorage.getItem('retain_token') === token) setUser(data.user);
      })
      .catch(() => {
        if (localStorage.getItem('retain_token') === token) localStorage.removeItem('retain_token');
      })
      .finally(() => setLoading(false));
  }, []);

  async function signIn(email: string, password: string) {
    const data = await api<{ token: string; user: User }>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('retain_token', data.token);
    setUser(data.user);
  }
  async function signUp(name: string, email: string, password: string) {
    const data = await api<{ token: string; user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    localStorage.setItem('retain_token', data.token);
    setUser(data.user);
  }
  function signOut() {
    localStorage.removeItem('retain_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
