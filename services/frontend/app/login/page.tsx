'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isAuthenticated, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, authLoading, router]);

  // Show error if redirected back from a failed OAuth attempt or expired session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'oauth_failed') {
      setError('OAuth login failed. Please try again or use email/password.');
    } else if (params.get('session') === 'expired') {
      setError('Your session expired. Please log in again.');
    }
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-mono text-sm text-text-secondary">
          <span className="animate-pulse">█</span> LOADING...
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      // Use replace so the login page isn't in browser history
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
    // Don't set loading=false on success — page is navigating away
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-text-primary">
            {isLogin ? 'LOGIN' : 'REGISTER'}
          </h1>
          <p className="text-sm text-text-secondary">
            {isLogin ? 'Access your job tracker' : 'Create your account'}
          </p>
        </div>

        {/* OAuth Buttons */}
        <div className="mb-6 space-y-3">
          <a
            href="/oauth2/authorization/google"
            className="
              flex w-full items-center justify-center gap-3
              border-2 border-black bg-white px-6 py-3
              font-mono text-sm font-bold text-text-primary
              shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
              transition-all
              hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
              hover:translate-x-[2px] hover:translate-y-[2px]
            "
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>

          <a
            href="/oauth2/authorization/github"
            className="
              flex w-full items-center justify-center gap-3
              border-2 border-black bg-white px-6 py-3
              font-mono text-sm font-bold text-text-primary
              shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
              transition-all
              hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
              hover:translate-x-[2px] hover:translate-y-[2px]
            "
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Continue with GitHub
          </a>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-black/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 font-mono font-bold text-text-tertiary">
                Or continue with email
              </span>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/assets/jobdog.png"
            alt="JobDog"
            width={120}
            height={120}
            className="pixelated"
          />
        </div>

        {/* Title */}
        <h1 className="mb-2 text-center font-mono text-2xl font-bold text-text-primary">
          jobdog.dev
        </h1>
        <p className="mb-8 text-center font-mono text-sm text-text-secondary">
          {isLogin ? 'LOGIN.EXE' : 'REGISTER.EXE'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="border-2 border-secondary bg-secondary/10 p-3">
              <p className="font-mono text-xs text-secondary">⚠ {error}</p>
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="mb-1 block font-mono text-xs font-bold uppercase text-text-secondary">
                DISPLAY_NAME
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border-2 border-black/10 bg-white px-4 py-3 font-mono text-sm focus:border-primary focus:outline-none"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block font-mono text-xs font-bold uppercase text-text-secondary">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-black/10 bg-white px-4 py-3 font-mono text-sm focus:border-primary focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs font-bold uppercase text-text-secondary">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-black/10 bg-white px-4 py-3 font-mono text-sm focus:border-primary focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border-2 border-black bg-primary px-8 py-4 font-mono text-sm font-bold uppercase text-text-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
          >
            {loading ? '...' : isLogin ? '> LOGIN' : '> REGISTER'}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="font-mono text-sm text-text-secondary hover:text-text-primary"
          >
            {isLogin ? 'Need an account? REGISTER.EXE' : 'Have an account? LOGIN.EXE'}
          </button>
        </div>
      </div>
    </div>
  );
}
