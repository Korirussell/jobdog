'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface DirectoryItem {
  icon: string;
  label: string;
  path: string;
  isFolder?: boolean;
  children?: DirectoryItem[];
}

const directoryStructure: DirectoryItem[] = [
  {
    icon: '📁',
    label: 'all_jobs.exe',
    path: '/',
  },
  {
    icon: '📁',
    label: 'saved_internships/',
    path: '/saved',
    isFolder: true,
  },
  {
    icon: '📁',
    label: 'applied_tracker/',
    path: '/applications',
    isFolder: true,
  },
  {
    icon: '📋',
    label: 'resume_vault/',
    path: '/resumes',
    isFolder: true,
  },
  {
    icon: '⚙️',
    label: 'settings.cfg',
    path: '/settings',
  },
];

export default function DirectoryTree() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string[]>(['/root']);

  const toggleExpand = (path: string) => {
    setExpanded((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r-2 border-black/20 bg-background-secondary">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b-2 border-black/20 bg-gray-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleExpand('/root')}
              className="text-primary"
            >
              {expanded.includes('/root') ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
            <span className="font-mono text-sm font-bold text-white">
              [-] /root
            </span>
          </div>
        </div>

        {/* Directory Tree */}
        {expanded.includes('/root') && (
          <nav className="flex-1 overflow-y-auto p-2">
            <div className="space-y-0.5">
              {directoryStructure.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`
                      group flex items-center gap-2 px-3 py-2
                      font-mono text-sm transition-all
                      ${
                        isActive
                          ? 'border-2 border-black bg-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]'
                          : 'border-2 border-transparent hover:border-black/20 hover:bg-white'
                      }
                    `}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="flex-1 truncate font-medium">
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="text-xs text-text-primary">◄</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {/* Footer Stats */}
        <div className="border-t-2 border-black/20 bg-gray-100 p-3">
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between text-text-secondary">
              <span>TOTAL_JOBS:</span>
              <span className="font-bold text-text-primary">1,829</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>LAST_SYNC:</span>
              <span className="font-bold text-text-primary">2h ago</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-300">
              <div className="h-full w-3/4 bg-primary"></div>
            </div>
            <div className="text-center text-[10px] text-text-tertiary">
              DB: 75% capacity
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
