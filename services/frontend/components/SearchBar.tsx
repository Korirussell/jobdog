'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch?: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
  };

  return (
    <div className="sticky top-0 z-10 border-b-2 border-black bg-background p-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs... (e.g., Software Engineer, Python, Remote)"
            className="
              w-full border-2 border-black bg-white px-4 py-3
              font-mono text-sm
              shadow-brutal-sm
              transition-all
              placeholder:text-gray-400
              focus:shadow-brutal focus:outline-none
            "
          />
        </div>
        
        <button
          type="submit"
          className="
            border-2 border-black bg-primary px-6 py-3
            font-mono text-sm font-bold uppercase
            shadow-brutal-sm
            transition-all
            hover:bg-primary-dark hover:shadow-brutal
            active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
          "
        >
          🔍 Search
        </button>
      </form>

      {/* Quick Filters */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold hover:bg-gray-100">
          💼 INTERNSHIP
        </button>
        <button className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold hover:bg-gray-100">
          🏠 REMOTE
        </button>
        <button className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold hover:bg-gray-100">
          🌟 NEW
        </button>
        <button className="border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold hover:bg-gray-100">
          📍 US ONLY
        </button>
      </div>
    </div>
  );
}
