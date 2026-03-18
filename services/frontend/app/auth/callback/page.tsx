'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setUserFromOAuth } = useAuth();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userId = params.get('userId');
    const email = params.get('email');
    const displayName = params.get('displayName');
    const error = params.get('error');

    if (error) {
      setErrorMsg('OAuth login failed. Please try again.');
      setStatus('error');
      return;
    }

    if (!token || !userId || !email) {
      setErrorMsg('Missing authentication data. Please try again.');
      setStatus('error');
      return;
    }

    api.setToken(token);
    setUserFromOAuth({ userId, email, displayName: displayName || email.split('@')[0] });
    router.replace('/');
  }, [router, setUserFromOAuth]);

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md border-2 border-secondary bg-secondary/10 p-6 text-center">
          <p className="font-mono text-sm font-bold text-secondary">⚠ {errorMsg}</p>
          <a
            href="/login"
            className="mt-4 inline-block font-mono text-xs text-text-secondary underline hover:text-text-primary"
          >
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p className="font-mono text-sm font-bold text-text-secondary">
          <span className="animate-pulse">█</span> AUTHENTICATING...
        </p>
      </div>
    </div>
  );
}
