'use client';

import { useState } from 'react';

interface FilterBarProps {
  onFilterChange?: (filters: FilterState) => void;
  onSearchChange?: (search: string) => void;
}

export interface FilterState {
  remote: boolean;
  employmentType: string;
  location: string;
  company: string;
}

export default function FilterBar({ onFilterChange, onSearchChange }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    remote: false,
    employmentType: 'all',
    location: '',
    company: '',
  });

  const updateFilter = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const activeFilterCount = [
    filters.remote,
    filters.employmentType !== 'all',
    filters.location,
    filters.company,
  ].filter(Boolean).length;

  return (
    <div className="border-b-2 border-black/10 bg-background">
      <div className="flex flex-wrap items-center gap-2 py-3 sm:gap-3">
        {/* Filters Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="
            flex items-center gap-2 border-2 border-black/20 bg-white px-4 py-1.5
            font-mono text-xs font-bold uppercase text-text-primary
            transition-all hover:border-black hover:bg-background-secondary
          "
        >
          <span>📁</span>
          <span>FILTERS</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px]">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Search on right */}
        <div className="ml-auto flex w-full items-center sm:w-auto">
          <input
            type="text"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
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

      {/* Filter Panel */}
      {showFilters && (
        <div className="border-t-2 border-black/10 bg-background-secondary p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Remote Toggle */}
            <div>
              <label className="mb-2 block font-mono text-xs font-bold uppercase text-text-secondary">
                LOCATION_TYPE
              </label>
              <button
                onClick={() => updateFilter('remote', !filters.remote)}
                className={`
                  w-full border-2 px-4 py-2 font-mono text-xs font-bold uppercase
                  transition-all
                  ${
                    filters.remote
                      ? 'border-black bg-primary text-text-primary'
                      : 'border-black/20 bg-white text-text-secondary hover:border-black'
                  }
                `}
              >
                {filters.remote ? '✓ REMOTE_ONLY' : 'ALL_LOCATIONS'}
              </button>
            </div>

            {/* Employment Type */}
            <div>
              <label className="mb-2 block font-mono text-xs font-bold uppercase text-text-secondary">
                JOB_TYPE
              </label>
              <select
                value={filters.employmentType}
                onChange={(e) => updateFilter('employmentType', e.target.value)}
                className="
                  w-full border-2 border-black/20 bg-white px-4 py-2
                  font-mono text-xs font-bold uppercase text-text-primary
                  focus:border-primary focus:outline-none
                "
              >
                <option value="all">ALL_TYPES</option>
                <option value="INTERNSHIP">INTERNSHIP</option>
                <option value="FULL_TIME">FULL_TIME</option>
                <option value="PART_TIME">PART_TIME</option>
                <option value="CONTRACT">CONTRACT</option>
              </select>
            </div>

            {/* Location Filter */}
            <div>
              <label className="mb-2 block font-mono text-xs font-bold uppercase text-text-secondary">
                LOCATION
              </label>
              <input
                type="text"
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
                placeholder="e.g., San Francisco"
                className="
                  w-full border-2 border-black/10 bg-white px-3 py-2
                  font-mono text-xs text-text-primary
                  placeholder-text-tertiary
                  focus:border-primary focus:outline-none
                "
              />
            </div>

            {/* Company Filter */}
            <div>
              <label className="mb-2 block font-mono text-xs font-bold uppercase text-text-secondary">
                COMPANY
              </label>
              <input
                type="text"
                value={filters.company}
                onChange={(e) => updateFilter('company', e.target.value)}
                placeholder="e.g., Google"
                className="
                  w-full border-2 border-black/10 bg-white px-3 py-2
                  font-mono text-xs text-text-primary
                  placeholder-text-tertiary
                  focus:border-primary focus:outline-none
                "
              />
            </div>
          </div>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                const clearedFilters = {
                  remote: false,
                  employmentType: 'all',
                  location: '',
                  company: '',
                };
                setFilters(clearedFilters);
                onFilterChange?.(clearedFilters);
              }}
              className="
                mt-4 border-2 border-black/20 bg-white px-4 py-2
                font-mono text-xs font-bold uppercase text-text-secondary
                transition-all hover:border-black hover:text-text-primary
              "
            >
              CLEAR_ALL
            </button>
          )}
        </div>
      )}
    </div>
  );
}
