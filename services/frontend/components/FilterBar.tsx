'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const filters = [
  {
    label: 'Role',
    options: ['All Roles', 'Software Engineer', 'Product Manager', 'Data Science', 'Design'],
  },
  {
    label: 'Remote',
    options: ['All Locations', 'Remote', 'Hybrid', 'On-site'],
  },
  {
    label: 'Match %',
    options: ['All Matches', '90%+', '80%+', '70%+', '60%+'],
  },
  {
    label: 'Tech Stack',
    options: ['All Stacks', 'Python', 'JavaScript', 'Java', 'Go', 'Rust'],
  },
];

export default function FilterBar() {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="sticky top-0 z-10 border-b border-gray-300 bg-background px-6 py-4 shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        {/* Filter Pills */}
        {filters.map((filter) => (
          <div key={filter.label} className="relative">
            <button
              className="
                flex items-center gap-2 rounded-lg border border-gray-300
                bg-white px-4 py-2 font-mono text-sm font-medium
                text-text-primary transition-all hover:border-primary
                hover:bg-primary-light
              "
            >
              <span>{activeFilters[filter.label] || filter.label}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        ))}

        {/* Small Search Input (de-emphasized) */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="
            ml-auto w-48 rounded-lg border border-gray-300 bg-white
            px-3 py-2 font-mono text-sm text-text-primary
            placeholder-text-tertiary transition-all
            focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary
          "
        />
      </div>
    </div>
  );
}
