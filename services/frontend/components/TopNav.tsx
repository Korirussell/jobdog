'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Search } from 'lucide-react';

interface TopNavProps {
  onSearchClick?: () => void;
}

export default function TopNav({ onSearchClick }: TopNavProps) {
  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo - Center prominence */}
        <Link href="/" className="flex items-center gap-3 transition-smooth hover:opacity-80">
          <div className="relative h-10 w-10">
            <Image
              src="/assets/jobdog.png"
              alt="JobDog Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-xl font-semibold text-gray-900">
            JobDog<span className="text-gray-400">.dev</span>
          </span>
        </Link>

        {/* Center - Search */}
        <button
          onClick={onSearchClick}
          className="
            flex items-center gap-2 rounded-lg border border-gray-200 
            bg-gray-50 px-4 py-2 text-sm text-gray-600
            transition-smooth hover:border-gray-300 hover:bg-gray-100
          "
        >
          <Search size={16} />
          <span>Search jobs...</span>
          <kbd className="ml-2 rounded bg-white px-2 py-0.5 text-xs text-gray-500">
            ⌘K
          </kbd>
        </button>

        {/* Right - Auth buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="
              rounded-lg px-4 py-2 text-sm font-medium text-gray-700
              transition-smooth hover:bg-gray-100
            "
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="
              rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white
              transition-smooth hover:bg-gray-800
            "
          >
            Sign up
          </Link>
        </div>
      </div>
    </nav>
  );
}
