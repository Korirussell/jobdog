'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api } from '@/lib/api';

interface User {
  userId: string;
  email: string;
  displayName: string;
  profileVisibility?: string;
  shareName?: string | null;
  role?: string;
  // Resume uploads left, and how many more job-link confirmations earn the next one.
  resumeCredits?: number;
  reportsToNextCredit?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  setUserFromOAuth: (user: User) => void;
  updateShareName: (name: string) => Promise<void>;
  // Re-reads the signed-in user, e.g. after spending or earning an upload.
  refreshUser: () => Promise<void>;
  // Applies credit state returned by an action without another round trip.
  applyCredits: (resumeCredits: number, reportsToNextCredit: number) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toUser(data: {
  userId: string;
  email: string;
  displayName: string;
  profileVisibility?: string;
  shareName?: string | null;
  role?: string;
  resumeCredits?: number;
  reportsToNextCredit?: number;
}): User {
  return {
    userId: data.userId,
    email: data.email,
    displayName: data.displayName,
    profileVisibility: data.profileVisibility,
    shareName: data.shareName,
    role: data.role,
    resumeCredits: data.resumeCredits,
    reportsToNextCredit: data.reportsToNextCredit,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      setUser(toUser(await api.me()));
    } catch {
      // Leave whatever we had; a failed refresh shouldn't sign anyone out.
    }
  }, []);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.me()
        .then((data) => setUser(toUser(data)))
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
    refreshUser();
  };

  const register = async (email: string, password: string, displayName: string) => {
    const data = await api.register(email, password, displayName);
    setUser({
      userId: data.userId,
      email: data.email,
      displayName: data.displayName,
    });
    refreshUser();
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
  };

  const setUserFromOAuth = useCallback((oauthUser: User) => {
    setUser(oauthUser);
    refreshUser();
  }, [refreshUser]);

  const updateShareName = async (name: string) => {
    const data = await api.updateProfile({ shareName: name });
    setUser((current) => current ? { ...current, shareName: data.shareName } : current);
  };

  const applyCredits = useCallback((resumeCredits: number, reportsToNextCredit: number) => {
    setUser((current) => current ? { ...current, resumeCredits, reportsToNextCredit } : current);
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    setUserFromOAuth,
    updateShareName,
    refreshUser,
    applyCredits,
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
