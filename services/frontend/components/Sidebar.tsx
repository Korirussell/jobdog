'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  icon: string;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: '📁', label: '/jobs/all', path: '/' },
  { icon: '⭐', label: '/jobs/saved', path: '/saved' },
  { icon: '📄', label: '/applications', path: '/applications' },
  { icon: '📋', label: '/resumes', path: '/resumes' },
  { icon: '👤', label: '/profile/settings', path: '/profile' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r-2 border-black bg-background">
      <div className="flex h-full flex-col">
        {/* Logo Section */}
        <div className="border-b-2 border-black bg-primary p-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 border-2 border-black bg-white shadow-brutal-sm">
              <Image
                src="/assets/jobdog.png"
                alt="JobDog Logo"
                fill
                className="object-contain p-1"
                priority
              />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold uppercase tracking-tight text-black">
                JobDog
              </h1>
              <p className="font-mono text-xs text-gray-800">v1.0.0</p>
            </div>
          </div>
        </div>

        {/* Directory Tree Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`
                    flex items-center gap-2 border-2 border-black px-3 py-2
                    font-mono text-sm transition-all
                    ${
                      isActive
                        ? 'bg-primary shadow-brutal-sm'
                        : 'bg-white hover:bg-gray-100 hover:shadow-brutal-sm'
                    }
                  `}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="font-medium">&gt; {item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer Stats */}
        <div className="border-t-2 border-black bg-gray-100 p-3">
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-gray-800">Jobs:</span>
              <span className="font-bold">1,829</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-800">Updated:</span>
              <span className="font-bold">6h ago</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
