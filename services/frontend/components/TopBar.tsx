'use client';

import { useEffect, useRef, useState } from 'react';
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

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const initials = user?.displayName
    ? user.displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    router.replace('/');
  };

  const visibleLinks = NAV_LINKS.filter((l) => !l.authOnly || isAuthenticated);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-black/10 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">

        {/* Left: Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
          <Image src="/assets/jobdog.png" alt="JobDog" width={28} height={28} className="pixelated" />
          <span className="font-mono text-sm font-bold text-text-primary">jobdog.dev</span>
        </Link>

        {/* Center: Nav links (desktop) */}
        <nav className="hidden items-center gap-1 md:flex">
          {visibleLinks.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`
                  rounded-none border-2 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide
                  transition-all
                  ${active
                    ? 'border-black bg-primary text-text-primary'
                    : 'border-transparent text-text-secondary hover:border-black/20 hover:bg-background-secondary hover:text-text-primary'
                  }
                `}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Auth */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 md:hidden"
            aria-label="Toggle menu"
          >
            <span className={`block h-0.5 w-5 bg-text-primary transition-all ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-5 bg-text-primary transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 bg-text-primary transition-all ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>

          {!loading && (
            <>
              {isAuthenticated ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2 border-2 border-black/20 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-text-primary transition-all hover:border-black hover:bg-background-secondary"
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                  >
                    <span className="flex h-6 w-6 items-center justify-center bg-primary font-mono text-[10px] font-bold text-text-primary">
                      {initials}
                    </span>
                    <span className="hidden max-w-[80px] truncate sm:block">
                      {user?.displayName?.split(' ')[0] ?? 'USER'}
                    </span>
                    <svg
                      className={`h-3 w-3 text-text-tertiary transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-56 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      {/* User info */}
                      <div className="border-b-2 border-black/10 px-4 py-3">
                        <p className="truncate font-mono text-xs font-bold text-text-primary">{user?.displayName}</p>
                        <p className="truncate font-mono text-xs text-text-tertiary">{user?.email}</p>
                      </div>

                      {/* Nav items */}
                      <div className="py-1">
                        {[
                          { href: '/', label: '🏠 Home' },
                          { href: '/vault', label: '📁 Vault' },
                          { href: '/saved', label: '★ Saved Jobs' },
                          { href: '/applications', label: '📋 Applications' },
                          { href: '/settings', label: '⚙ Settings' },
                        ].map(({ href, label }) => (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setMenuOpen(false)}
                            className={`
                              flex items-center px-4 py-2.5 font-mono text-xs font-bold
                              transition-colors hover:bg-background-secondary
                              ${pathname === href ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}
                            `}
                          >
                            {label}
                          </Link>
                        ))}
                      </div>

                      {/* Logout */}
                      <div className="border-t-2 border-black/10 py-1">
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center px-4 py-2.5 font-mono text-xs font-bold text-danger transition-colors hover:bg-danger/10"
                        >
                          ⏻ Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="border-2 border-black/20 bg-white px-3 py-1.5 font-mono text-xs font-bold text-text-secondary transition-all hover:border-black hover:text-text-primary"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/login"
                    className="border-2 border-black bg-primary px-3 py-1.5 font-mono text-xs font-bold text-text-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile nav drawer */}
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
                    border-2 px-4 py-2.5 font-mono text-sm font-bold uppercase
                    ${active
                      ? 'border-black bg-primary text-text-primary'
                      : 'border-transparent text-text-secondary hover:border-black/20 hover:bg-background-secondary hover:text-text-primary'
                    }
                  `}
                >
                  {label}
                </Link>
              );
            })}
            {isAuthenticated && (
              <>
                <Link href="/settings" className="border-2 border-transparent px-4 py-2.5 font-mono text-sm font-bold uppercase text-text-secondary hover:border-black/20 hover:bg-background-secondary hover:text-text-primary">
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="border-2 border-transparent px-4 py-2.5 text-left font-mono text-sm font-bold uppercase text-danger hover:border-danger/20 hover:bg-danger/10"
                >
                  Logout
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
