'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setUserFromOAuth } = useAuth();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
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
    setUserFromOAuth({
      userId,
      email,
      displayName: displayName || email.split('@')[0],
    });
    router.replace('/');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="mb-8">
          <Image src="/assets/jobdog.png" alt="JobDog" width={80} height={80} className="pixelated" />
        </div>
        <div className="w-full max-w-md border-2 border-secondary bg-secondary/10 p-6 text-center">
          <p className="font-mono text-sm font-bold text-secondary">⚠ {errorMsg}</p>
          <a
            href="/login"
            className="mt-4 inline-block border-2 border-black bg-primary px-6 py-2 font-mono text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            &lt; BACK TO LOGIN
          </a>
          <div className="mt-4">
            <a href="/" className="font-mono text-xs text-text-tertiary underline hover:text-text-primary">
              Return to job listings
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mb-8">
        <Image src="/assets/jobdog.png" alt="JobDog" width={80} height={80} className="pixelated" />
      </div>
      <p className="font-mono text-sm font-bold text-text-secondary">
        <span className="animate-pulse">█</span> AUTHENTICATING...
      </p>
      <p className="mt-2 font-mono text-xs text-text-tertiary">Logging you in, please wait.</p>
    </div>
  );
}
