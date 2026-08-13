'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api } from '@/lib/api';

interface User {
  userId: string;
  email: string;
  displayName: string;
  profileVisibility?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  setUserFromOAuth: (user: User) => void;
  updateProfileVisibility: (visibility: string) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.me()
        .then((data) => {
          setUser({
            userId: data.userId,
            email: data.email,
            displayName: data.displayName,
            profileVisibility: data.profileVisibility,
          });
        })
        .catch(() => {
          api.clearToken();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password);
    setUser({
      userId: data.userId,
      email: data.email,
      displayName: data.displayName,
    });
  };

  const register = async (email: string, password: string, displayName: string) => {
    const data = await api.register(email, password, displayName);
    setUser({
      userId: data.userId,
      email: data.email,
      displayName: data.displayName,
    });
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
  };

  const setUserFromOAuth = useCallback((oauthUser: User) => {
    setUser(oauthUser);
  }, []);

  const updateProfileVisibility = async (visibility: string) => {
    const data = await api.updateProfile(visibility);
    setUser((current) => current ? { ...current, profileVisibility: data.profileVisibility } : current);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    setUserFromOAuth,
    updateProfileVisibility,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
