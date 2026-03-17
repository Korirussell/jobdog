'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const quickFilters = [
  { label: 'Internship', value: 'internship' },
  { label: 'Remote', value: 'remote' },
  { label: 'New', value: 'new' },
  { label: 'US Only', value: 'us' },
];

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleCmdK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('keydown', handleCmdK);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleCmdK);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-xl bg-white shadow-xl">
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b border-gray-200 px-4">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs... (e.g., Software Engineer, Python, Remote)"
              className="
                flex-1 border-0 bg-transparent py-4 text-base
                text-gray-900 placeholder-gray-400
                focus:outline-none
              "
              autoFocus
            />
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-smooth hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Filters */}
          <div className="border-b border-gray-200 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
              Quick Filters
            </p>
            <div className="flex flex-wrap gap-2">
              {quickFilters.map((filter) => (
                <button
                  key={filter.value}
                  className="
                    rounded-full border border-gray-200 bg-white px-4 py-1.5
                    text-sm font-medium text-gray-700
                    transition-smooth hover:border-primary hover:bg-primary-light
                  "
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recent Searches */}
          <div className="p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
              Recent Searches
            </p>
            <div className="space-y-2">
              {['Software Engineer', 'Product Manager', 'Data Science'].map((search) => (
                <button
                  key={search}
                  className="
                    flex w-full items-center gap-3 rounded-lg px-3 py-2
                    text-left text-sm text-gray-700
                    transition-smooth hover:bg-gray-100
                  "
                >
                  <Search size={16} className="text-gray-400" />
                  {search}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
