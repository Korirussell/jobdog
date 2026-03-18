'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Renders children only when authenticated.
 * While auth is resolving, renders a loading skeleton.
 * When unauthenticated, redirects to /login.
 *
 * IMPORTANT: wrap only the page *content* with this, not the entire page
 * (keep MorphingHeader outside so the user always has home navigation).
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="font-mono text-sm text-text-secondary">
          <span className="animate-pulse">█</span> AUTHENTICATING...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
