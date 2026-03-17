'use client';

import { useState } from 'react';

interface Filter {
  id: string;
  label: string;
  count?: number;
}

const filters: Filter[] = [
  { id: 'all', label: 'ALL' },
  { id: 'remote', label: 'REMOTE' },
  { id: 'high-match', label: 'HIGH_MATCH' },
  { id: 'new', label: 'NEW' },
];

interface FilterBarProps {
  onFilterChange?: (filter: string) => void;
  onSearchChange?: (search: string) => void;
}

export default function FilterBar({ onFilterChange, onSearchChange }: FilterBarProps) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchValue, setSearchValue] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-2 border-b-2 border-black/10 bg-background py-3 sm:gap-3">
      {/* Filter Pills */}
      {filters.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <button
            key={filter.id}
            onClick={() => {
              setActiveFilter(filter.id);
              onFilterChange?.(filter.id);
            }}
            className={`
              px-4 py-1.5 font-mono text-xs font-bold uppercase
              transition-all
              ${
                isActive
                  ? 'border-2 border-black/20 bg-primary text-text-primary'
                  : 'border-2 border-transparent text-text-secondary hover:border-black/10 hover:text-text-primary'
              }
            `}
          >
            {filter.label}
            {filter.count !== undefined && (
              <span className="ml-1.5 opacity-60">({filter.count})</span>
            )}
          </button>
        );
      })}

      {/* Search on right */}
      <div className="ml-auto flex w-full items-center sm:w-auto">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            // Debounce search - wait 300ms after user stops typing
            const timeoutId = setTimeout(() => {
              onSearchChange?.(e.target.value);
            }, 300);
            return () => clearTimeout(timeoutId);
          }}
          placeholder="SEARCH..."
          className="
            w-full border-2 border-black/10 bg-white px-3 py-1.5
            font-mono text-xs text-text-primary
            placeholder-text-tertiary
            focus:border-primary focus:outline-none
            sm:w-56
          "
        />
      </div>
    </div>
  );
}
