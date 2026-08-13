'use client';

import { useState } from 'react';

export type JobTab = 'intern' | 'newgrad';

interface FilterBarProps {
  // Controlled: the URL (via HomePageClient's useSearchParams) is the single
  // source of truth for filter state, so a page refresh, back-button press, or
  // shared link reproduces exactly what was showing. This component only owns
  // UI-only state (the search textbox's live value, whether the panel is open).
  filters: FilterState;
  onFilterChange?: (filters: FilterState) => void;
  initialSearch?: string;
  onSearchChange?: (search: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

// "" = any grad year. Only meaningful on the New Grad tab — an intern posting
// has no graduation-cohort gate to filter by.
export type GradYearFilter = '' | '2026' | '2027';

export interface FilterState {
  tab: JobTab;
  remote: boolean;
  location: string;
  hideApplied: boolean;
  // "" = any company. "FAANG" / "UNICORN" match CompanyTier.lookup on the backend.
  companyTier: '' | 'FAANG' | 'UNICORN';
  gradYear: GradYearFilter;
  hasSalary: boolean;
}

export default function FilterBar({ filters, onFilterChange, initialSearch, onSearchChange, searchInputRef }: FilterBarProps) {
  const [searchValue, setSearchValue] = useState(initialSearch ?? '');
  const [showMore, setShowMore] = useState(false);

  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const next = { ...filters, [key]: value };
    // A grad-year filter only means something on the New Grad tab; switching to
    // Internships with one still set would silently filter out every result.
    if (key === 'tab' && value !== 'newgrad') {
      next.gradYear = '';
    }
    onFilterChange?.(next);
  };

  const hasExtraFilters = filters.remote || !!filters.location || filters.hideApplied ||
    !!filters.companyTier || !!filters.gradYear || filters.hasSalary;

  return (
    <div className="border-b border-black/10 bg-white">
      {/* ── Main bar ── */}
      <div className="px-2 py-2">
        {/* Row 1: tabs + filters toggle + pills (+ search on sm+) */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Intern / New Grad tabs */}
          <div className="flex border border-black/15">
            {(['intern', 'newgrad'] as JobTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => update('tab', tab)}
                className={`
                  px-4 py-2 font-mono text-xs font-bold transition-colors
                  ${filters.tab === tab
                    ? 'bg-primary text-text-primary'
                    : 'bg-white text-text-secondary hover:bg-black/5 hover:text-text-primary'
                  }
                `}
              >
                {tab === 'intern' ? 'Internships' : 'New Grad'}
              </button>
            ))}
          </div>

          {/* More filters toggle */}
          <button
            onClick={() => setShowMore((v) => !v)}
            className={`
              flex items-center gap-1.5 border px-3 py-2 font-mono text-xs font-bold transition-colors
              ${hasExtraFilters || showMore
                ? 'border-black/40 bg-black/5 text-text-primary'
                : 'border-black/15 bg-white text-text-secondary hover:border-black/30 hover:text-text-primary'
              }
            `}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M6 12h12M9 20h6" />
            </svg>
            Filters
            {hasExtraFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-text-primary">
                {[filters.remote, !!filters.location, filters.hideApplied, !!filters.companyTier, !!filters.gradYear, filters.hasSalary].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Active filter pills — hidden on very small screens, shown inline on sm+ */}
          <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
            {filters.remote && (
              <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                Remote only
                <button onClick={() => update('remote', false)} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
              </span>
            )}
            {filters.location && (
              <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                📍 {filters.location}
                <button onClick={() => update('location', '')} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
              </span>
            )}
            {filters.hideApplied && (
              <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                Hide applied
                <button onClick={() => update('hideApplied', false)} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
              </span>
            )}
            {filters.companyTier && (
              <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                {filters.companyTier}
                <button onClick={() => update('companyTier', '')} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
              </span>
            )}
            {filters.gradYear && (
              <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                Class of {filters.gradYear}
                <button onClick={() => update('gradYear', '')} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
              </span>
            )}
            {filters.hasSalary && (
              <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                Pay listed
                <button onClick={() => update('hasSalary', false)} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
              </span>
            )}
          </div>

          {/* Search — right side on sm+, hidden on mobile (shown in row 2) */}
          <div className="ml-auto hidden sm:block">
            <div className="relative">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => { setSearchValue(e.target.value); onSearchChange?.(e.target.value); }}
                placeholder="Search jobs..."
                className="w-48 border border-black/15 bg-white py-1.5 pl-8 pr-8 font-mono text-xs text-text-primary placeholder-text-tertiary focus:border-black/40 focus:outline-none sm:w-56"
              />
              {searchValue ? (
                <button onClick={() => { setSearchValue(''); onSearchChange?.(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-black/5 px-1 py-0.5 font-mono text-[9px] text-text-tertiary">⌘K</kbd>
              )}
            </div>
          </div>
        </div>

        {/* Row 2 (mobile only): full-width search + active pills */}
        <div className="mt-2 sm:hidden">
          <div className="relative w-full">
            <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchValue}
              onChange={(e) => { setSearchValue(e.target.value); onSearchChange?.(e.target.value); }}
              placeholder="Search jobs..."
              className="w-full border border-black/15 bg-white py-2.5 pl-9 pr-9 font-mono text-sm text-text-primary placeholder-text-tertiary focus:border-black/40 focus:outline-none"
            />
            {searchValue && (
              <button onClick={() => { setSearchValue(''); onSearchChange?.(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {/* Active pills on mobile */}
          {hasExtraFilters && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {filters.remote && (
                <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                  Remote only
                  <button onClick={() => update('remote', false)} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
                </span>
              )}
              {filters.location && (
                <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                  📍 {filters.location}
                  <button onClick={() => update('location', '')} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
                </span>
              )}
              {filters.hideApplied && (
                <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                  Hide applied
                  <button onClick={() => update('hideApplied', false)} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
                </span>
              )}
              {filters.companyTier && (
                <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                  {filters.companyTier}
                  <button onClick={() => update('companyTier', '')} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
                </span>
              )}
              {filters.gradYear && (
                <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                  Class of {filters.gradYear}
                  <button onClick={() => update('gradYear', '')} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
                </span>
              )}
              {filters.hasSalary && (
                <span className="flex items-center gap-1 border border-black/20 bg-black/5 px-2 py-1 font-mono text-[10px] font-bold">
                  Pay listed
                  <button onClick={() => update('hasSalary', false)} className="ml-0.5 text-text-tertiary hover:text-text-primary">✕</button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Expanded filter panel ── */}
      {showMore && (
        <div className="border-t border-black/8 bg-black/[0.02] px-4 py-3">
          <div className="flex flex-wrap items-end gap-4">

            {/* Remote toggle */}
            <div>
              <p className="mb-1.5 font-mono text-[10px] font-bold uppercase text-text-tertiary">Location type</p>
              <button
                onClick={() => update('remote', !filters.remote)}
                className={`
                  flex items-center gap-1.5 border px-3 py-1.5 font-mono text-xs font-bold transition-colors
                  ${filters.remote
                    ? 'border-black bg-primary text-text-primary'
                    : 'border-black/20 bg-white text-text-secondary hover:border-black/40'
                  }
                `}
              >
                {filters.remote ? '✓ Remote only' : 'All locations'}
              </button>
            </div>

            {/* Location text */}
            <div>
              <p className="mb-1.5 font-mono text-[10px] font-bold uppercase text-text-tertiary">City / State</p>
              <input
                type="text"
                value={filters.location}
                onChange={(e) => update('location', e.target.value)}
                placeholder="e.g. San Francisco"
                className="border border-black/15 bg-white px-3 py-1.5 font-mono text-xs text-text-primary placeholder-text-tertiary focus:border-black/40 focus:outline-none"
              />
            </div>

            {/* Hide applied */}
            <div>
              <p className="mb-1.5 font-mono text-[10px] font-bold uppercase text-text-tertiary">Applied jobs</p>
              <button
                onClick={() => update('hideApplied', !filters.hideApplied)}
                className={`
                  flex items-center gap-1.5 border px-3 py-1.5 font-mono text-xs font-bold transition-colors
                  ${filters.hideApplied
                    ? 'border-black bg-primary text-text-primary'
                    : 'border-black/20 bg-white text-text-secondary hover:border-black/40'
                  }
                `}
              >
                {filters.hideApplied ? '✓ Hidden' : 'Show all'}
              </button>
            </div>

            {/* Company tier */}
            <div>
              <p className="mb-1.5 font-mono text-[10px] font-bold uppercase text-text-tertiary">Company tier</p>
              <div className="flex border border-black/15">
                {(['', 'FAANG', 'UNICORN'] as const).map((tier) => (
                  <button
                    key={tier || 'all'}
                    onClick={() => update('companyTier', tier)}
                    className={`
                      px-3 py-1.5 font-mono text-xs font-bold transition-colors
                      ${filters.companyTier === tier
                        ? 'bg-primary text-text-primary'
                        : 'bg-white text-text-secondary hover:bg-black/5 hover:text-text-primary'
                      }
                    `}
                  >
                    {tier || 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Graduation cohort — only meaningful once cohort-gated roles can be
                distinguished from open entry-level ones, which is New Grad only. */}
            {filters.tab === 'newgrad' && (
              <div>
                <p className="mb-1.5 font-mono text-[10px] font-bold uppercase text-text-tertiary">Graduating</p>
                <div className="flex border border-black/15">
                  {(['', '2026', '2027'] as const).map((year) => (
                    <button
                      key={year || 'any'}
                      onClick={() => update('gradYear', year)}
                      className={`
                        px-3 py-1.5 font-mono text-xs font-bold transition-colors
                        ${filters.gradYear === year
                          ? 'bg-primary text-text-primary'
                          : 'bg-white text-text-secondary hover:bg-black/5 hover:text-text-primary'
                        }
                      `}
                    >
                      {year || 'Any year'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pay listed */}
            <div>
              <p className="mb-1.5 font-mono text-[10px] font-bold uppercase text-text-tertiary">Compensation</p>
              <button
                onClick={() => update('hasSalary', !filters.hasSalary)}
                className={`
                  flex items-center gap-1.5 border px-3 py-1.5 font-mono text-xs font-bold transition-colors
                  ${filters.hasSalary
                    ? 'border-black bg-primary text-text-primary'
                    : 'border-black/20 bg-white text-text-secondary hover:border-black/40'
                  }
                `}
              >
                {filters.hasSalary ? '✓ Pay listed only' : 'All postings'}
              </button>
            </div>

            {/* Clear all */}
            {hasExtraFilters && (
              <button
                onClick={() => {
                  const reset: FilterState = { tab: filters.tab, remote: false, location: '', hideApplied: false, companyTier: '', gradYear: '', hasSalary: false };
                  onFilterChange?.(reset);
                }}
                className="mb-0 border border-black/15 px-3 py-1.5 font-mono text-xs text-text-tertiary transition-colors hover:border-black/30 hover:text-text-primary"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
