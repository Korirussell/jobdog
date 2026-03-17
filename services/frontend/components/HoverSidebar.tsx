'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Star, FileText, Clipboard, User } from 'lucide-react';

interface NavItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'All Jobs', path: '/' },
  { icon: Star, label: 'Saved', path: '/saved' },
  { icon: FileText, label: 'Applications', path: '/applications' },
  { icon: Clipboard, label: 'Resumes', path: '/resumes' },
  { icon: User, label: 'Profile', path: '/profile' },
];

export default function HoverSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] bg-white shadow-sm transition-smooth"
      style={{ width: isExpanded ? '240px' : '60px' }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <nav className="flex h-full flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2.5
                transition-smooth
                ${
                  isActive
                    ? 'bg-primary-light text-primary-dark'
                    : 'text-gray-700 hover:bg-gray-100'
                }
              `}
            >
              <Icon size={20} className="flex-shrink-0" />
              <span
                className={`
                  text-sm font-medium transition-smooth
                  ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}
                `}
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
