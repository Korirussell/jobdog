'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

export default function MorphingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, logout, loading } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = window.innerHeight * 0.7;
      setScrolled(window.scrollY > heroHeight);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.displayName
    ? user.displayName.trim().split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '??';

  const AuthCorner = ({ compact = false }: { compact?: boolean }) => {
    if (loading) return null;

    if (!isAuthenticated) {
      return (
        <a
          href="/login"
          className={`
            px-2 py-1 font-mono font-bold text-text-secondary
            transition-colors hover:text-text-primary
            ${compact ? 'text-xs' : 'text-sm sm:text-sm'}
          `}
        >
          LOGIN
        </a>
      );
    }

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className={`
            flex items-center gap-2 border-2 border-black/20 bg-white
            font-mono font-bold text-text-primary
            transition-all hover:border-black hover:bg-background-secondary
            ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
          `}
          aria-label="Open profile menu"
        >
          <span
            className={`
              flex items-center justify-center rounded-none bg-primary font-mono font-bold text-text-primary
              ${compact ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-xs'}
            `}
          >
            {initials}
          </span>
          <span className={compact ? 'hidden sm:inline' : ''}>{user?.displayName?.split(' ')[0] ?? 'USER'}</span>
          <span className="text-text-tertiary">▾</span>
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-52 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-2 border-black/10 px-4 py-3">
              <p className="font-mono text-xs font-bold text-text-primary truncate">{user?.displayName}</p>
              <p className="font-mono text-xs text-text-tertiary truncate">{user?.email}</p>
            </div>
            <nav className="py-1">
              {[
                { href: '/vault', label: '📁 VAULT' },
                { href: '/saved', label: '★ SAVED JOBS' },
                { href: '/applications', label: '⚙ APPLIED' },
                { href: '/settings', label: '⚙ SETTINGS' },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setProfileOpen(false)}
                  className="block px-4 py-2 font-mono text-xs font-bold text-text-secondary transition-colors hover:bg-background-secondary hover:text-text-primary"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="border-t-2 border-black/10 py-1">
              <button
                onClick={() => {
                  logout();
                  setProfileOpen(false);
                }}
                className="w-full px-4 py-2 text-left font-mono text-xs font-bold text-secondary transition-colors hover:bg-secondary/10"
              >
                ⏻ LOGOUT
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Large Hero - Initial State */}
      <section
        className={`
          relative flex min-h-[85vh] flex-col items-center justify-center px-6 py-20
          transition-opacity duration-500
          ${scrolled ? 'pointer-events-none opacity-0' : 'opacity-100'}
        `}
      >
        {/* Top-Right Utility Nav */}
        <div className="absolute right-3 top-3 flex items-center gap-2 sm:right-6 sm:top-6 sm:gap-4">
          {!isAuthenticated && (
            <a
              href="/vault"
              className="
                flex items-center gap-1 border-2 border-black/20 bg-white px-2 py-1
                font-mono text-xs font-bold text-text-primary
                transition-all hover:border-black hover:bg-background-secondary
                sm:gap-2 sm:px-3 sm:py-1.5
              "
            >
              <span>📁</span>
              <span className="hidden sm:inline">VAULT</span>
            </a>
          )}
          <AuthCorner />
        </div>

        <div className="mb-8">
          <Image
            src="/assets/jobdog.png"
            alt="JobDog Logo"
            width={200}
            height={200}
            className="pixelated"
            priority
          />
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl md:text-6xl lg:text-7xl">
          jobdog.dev
        </h1>

        <p className="mb-8 max-w-2xl text-center text-base text-text-secondary sm:text-lg md:text-xl">
          The high-speed SWE internship aggregator.
        </p>

        <button
          onClick={() => {
            const jobList = document.querySelector('main');
            jobList?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="
            group relative border-2 border-black bg-primary px-6 py-3
            font-mono text-sm font-bold uppercase text-text-primary
            shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
            transition-all
            hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
            hover:translate-x-[2px] hover:translate-y-[2px]
            active:shadow-none
            active:translate-x-[4px] active:translate-y-[4px]
            sm:px-8 sm:py-4 sm:text-base
          "
        >
          <span className="mr-2">&gt;</span>
          INITIALIZE_SCAN
        </button>

        <div className="mt-16 animate-bounce">
          <svg
            className="h-6 w-6 text-text-tertiary"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
        </div>
      </section>

      {/* Morphed Sticky Header - Scrolled State */}
      <div
        className={`
          fixed left-0 right-0 top-0 z-50 
          border-b-2 border-black/10 backdrop-blur-md
          transition-all duration-500
          ${
            scrolled
              ? 'translate-y-0 bg-background/90 opacity-100'
              : 'pointer-events-none -translate-y-full opacity-0'
          }
        `}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2">
          <a
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-70"
          >
            <Image
              src="/assets/jobdog.png"
              alt="JobDog"
              width={32}
              height={32}
              className="pixelated"
            />
            <div className="flex items-center gap-1.5 font-mono text-sm">
              <span className="font-bold text-text-primary">jobdog.dev</span>
              <span className="text-text-tertiary">~/</span>
              <span className="text-text-secondary">root</span>
              <span className="text-text-tertiary">/</span>
              <span className="font-bold text-text-primary">all_jobs.exe</span>
            </div>
          </a>

          <nav className="flex items-center gap-1 sm:gap-2">
            {isAuthenticated && (
              <>
                <a
                  href="/saved"
                  className="
                    border-2 border-transparent px-2 py-1.5 sm:px-4 sm:py-2
                    font-mono text-xs sm:text-sm font-bold uppercase text-text-secondary
                    transition-all
                    hover:border-black hover:bg-white hover:text-text-primary
                  "
                >
                  SAVED
                </a>
                <a
                  href="/applications"
                  className="
                    border-2 border-transparent px-2 py-1.5 sm:px-4 sm:py-2
                    font-mono text-xs sm:text-sm font-bold uppercase text-text-secondary
                    transition-all
                    hover:border-black hover:bg-white hover:text-text-primary
                  "
                >
                  APPLIED
                </a>
              </>
            )}
            <AuthCorner compact />
          </nav>
        </div>
      </div>
    </>
  );
}
