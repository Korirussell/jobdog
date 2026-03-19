'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const NAV_LINKS = [
  { href: '/', label: 'Jobs' },
  { href: '/saved', label: 'Saved', authOnly: true },
  { href: '/applications', label: 'Applied', authOnly: true },
  { href: '/vault', label: 'Vault', authOnly: true },
];

interface TopBarProps {
  onSearchFocus?: () => void;
}

export default function TopBar({ onSearchFocus }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    setDarkMode(saved === 'dark');
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };
  // Track button position so the dropdown can be fixed-positioned
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Recalculate dropdown position whenever it opens
  useEffect(() => {
    if (menuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
  }, [menuOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Close on scroll (dropdown is fixed so it'd float otherwise)
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [menuOpen]);

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // ⌘K / Ctrl+K → focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onSearchFocus?.();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onSearchFocus]);

  const initials = user?.displayName
    ? user.displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const handleLogout = useCallback(() => {
    logout();
    setMenuOpen(false);
    router.replace('/');
  }, [logout, router]);

  const visibleLinks = NAV_LINKS.filter((l) => !l.authOnly || isAuthenticated);

  return (
    <>
      <header className="sticky top-0 z-[100] border-b-2 border-black/10 bg-white/98 backdrop-blur-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">

          {/* ── Left: Logo ── */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
            <Image
              src="/assets/jobdog.png"
              alt="JobDog"
              width={40}
              height={40}
              className="pixelated"
              priority
            />
            <div className="flex flex-col leading-none">
              <span className="font-mono text-base font-bold text-text-primary">jobdog.dev</span>
              <span className="font-mono text-[10px] text-text-tertiary">intern jobs · new grad</span>
            </div>
          </Link>

          {/* ── Center: Nav links (desktop) ── */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {visibleLinks.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    relative px-3 py-2 font-mono text-sm font-bold transition-colors
                    ${active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}
                  `}
                >
                  {label}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── Right: Auth ── */}
          <div className="flex shrink-0 items-center gap-2">

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-8 w-8 items-center justify-center border border-black/20 bg-background text-text-tertiary transition-all hover:border-black/40 hover:text-text-primary"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 md:hidden"
              aria-label="Toggle menu"
            >
              <span className={`block h-0.5 w-5 bg-text-primary transition-all duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`block h-0.5 w-5 bg-text-primary transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-5 bg-text-primary transition-all duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
            </button>

            {/* Auth */}
            {!loading && (
              <>
                {isAuthenticated ? (
                  <button
                    ref={buttonRef}
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2 border-2 border-black/20 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-text-primary transition-all hover:border-black hover:bg-background-secondary"
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-primary font-mono text-[10px] font-bold text-text-primary">
                      {initials}
                    </span>
                    <span className="hidden max-w-[80px] truncate sm:block">
                      {user?.displayName?.split(' ')[0] ?? 'USER'}
                    </span>
                    <svg
                      className={`h-3 w-3 shrink-0 text-text-tertiary transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      href="/login"
                      className="hidden border-2 border-black/20 bg-white px-3 py-1.5 font-mono text-xs font-bold text-text-secondary transition-all hover:border-black hover:text-text-primary sm:block"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/login"
                      className="border-2 border-black bg-primary px-3 py-1.5 font-mono text-xs font-bold text-text-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                    >
                      Sign up →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Mobile nav drawer ── */}
        {mobileOpen && (
          <div className="border-t-2 border-black/10 bg-white px-4 pb-4 md:hidden">
            <nav className="flex flex-col gap-1 pt-3">
              {visibleLinks.map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`
                      flex items-center justify-between border-l-4 px-4 py-3 font-mono text-sm font-bold transition-colors
                      ${active
                        ? 'border-l-primary bg-primary/10 text-text-primary'
                        : 'border-l-transparent text-text-secondary hover:border-l-black/20 hover:bg-background-secondary hover:text-text-primary'
                      }
                    `}
                  >
                    {label}
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </Link>
                );
              })}
              {isAuthenticated && (
                <>
                  <Link
                    href="/settings"
                    className={`flex items-center border-l-4 px-4 py-3 font-mono text-sm font-bold transition-colors ${
                      pathname === '/settings'
                        ? 'border-l-primary bg-primary/10 text-text-primary'
                        : 'border-l-transparent text-text-secondary hover:border-l-black/20 hover:bg-background-secondary hover:text-text-primary'
                    }`}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="border-l-4 border-l-transparent px-4 py-3 text-left font-mono text-sm font-bold text-red-600 transition-colors hover:border-l-red-300 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* ── Profile dropdown — rendered as a fixed portal so it's NEVER clipped ── */}
      {menuOpen && dropdownPos && (
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-60 border-2 border-black bg-white/95 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] backdrop-blur-md"
          style={{ top: dropdownPos.top, right: dropdownPos.right }}
        >
          {/* User info */}
          <div className="border-b-2 border-black/10 bg-background/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary font-mono text-xs font-bold">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-bold text-text-primary">{user?.displayName}</p>
                <p className="truncate font-mono text-[10px] text-text-tertiary">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <div className="py-1">
            {[
              { href: '/', label: 'Jobs', icon: '💼' },
              { href: '/vault', label: 'Resume Vault', icon: '📁' },
              { href: '/saved', label: 'Saved Jobs', icon: '★' },
              { href: '/applications', label: 'Applications', icon: '📋' },
              { href: '/settings', label: 'Settings', icon: '⚙' },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`
                  flex items-center gap-2.5 px-4 py-2.5 font-mono text-xs font-bold
                  transition-colors hover:bg-background-secondary
                  ${pathname === href
                    ? 'bg-primary/10 text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                  }
                `}
              >
                <span className="w-4 text-center">{icon}</span>
                {label}
                {pathname === href && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t-2 border-black/10 py-1">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 font-mono text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
            >
              <span className="w-4 text-center">⏻</span>
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}
