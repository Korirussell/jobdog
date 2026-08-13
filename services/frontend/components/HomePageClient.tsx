'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import FilterBar, { FilterState } from '@/components/FolderTabs';
import JobListRow from '@/components/JobListRow';
import ConveyorBelt from '@/components/ConveyorBelt';
import ApplyModal from '@/components/ApplyModal';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { JobSummary } from '@/lib/public-jobs';

interface HomePageClientProps {
  initialJobs: JobSummary[];
  initialTotal: number;
  initialLastSync: string | null;
  initialPage: number;
  pageSize: number;
}

function formatSyncTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'recently';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// Reads the current filter state out of the URL. The URL is the single source
// of truth — see the comment on FilterBarProps in FolderTabs.tsx for why: a
// client-only `useState` here previously filtered only the ~100 jobs fetched
// for the current page, so a real, existing combination (e.g. New Grad + Class
// of 2027, which matches roughly 14 of 1,000+ active postings) would routinely
// show zero results just because none of the 14 landed on that page. Deriving
// filters from the URL keeps this component and app/page.tsx (which does the
// actual server-side filtering) reading the same values.
function filtersFromSearchParams(params: URLSearchParams): FilterState {
  const tab = params.get('tab') === 'newgrad' ? 'newgrad' : 'intern';
  const companyTierRaw = params.get('companyTier');
  const gradYearRaw = params.get('gradYear');
  return {
    tab,
    remote: params.get('remote') === 'true',
    location: params.get('location') ?? '',
    hideApplied: params.get('hideApplied') === 'true',
    companyTier: companyTierRaw === 'FAANG' || companyTierRaw === 'UNICORN' ? companyTierRaw : '',
    gradYear: tab === 'newgrad' && (gradYearRaw === '2026' || gradYearRaw === '2027') ? gradYearRaw : '',
    hasSalary: params.get('hasSalary') === 'true',
  };
}

export default function HomePageClient({ initialJobs, initialTotal, initialLastSync, initialPage, pageSize }: HomePageClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  // Server-filtered by app/page.tsx according to the current URL — this is
  // already the correct result set, not a superset that needs re-filtering.
  const allJobs = initialJobs;
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const totalFromApi = initialTotal;
  const page = initialPage;
  const lastSync = initialLastSync;
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [applyModal, setApplyModal] = useState<{ jobId: string; title: string; company: string; applyUrl: string } | null>(null);
  const [conveyorJobs, setConveyorJobs] = useState<Array<{ jobId: string; company: string; title: string }>>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const searchQuery = searchParams.get('search') ?? '';

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  // Navigates to the current path with `changes` merged into the existing query
  // string. Page resets to 0 on any filter/search change — staying on page 4 of
  // the old result set makes no sense once the set itself has changed. `search`
  // is handled separately (debounced) rather than through this path.
  const navigateWithFilters = useCallback((changes: Partial<Record<string, string | null>>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    // A hard navigation, not router.push. The App Router's client-side Router
    // Cache can reuse the previous render of this same route/segment when only
    // searchParams change — confirmed by observing window.location.href update
    // correctly via router.push (even combined with router.refresh()) while the
    // DOM kept showing the previous filter's results. A full navigation forces
    // app/page.tsx to genuinely re-run server-side with the new searchParams,
    // at the cost of a full page load instead of a client transition.
    window.location.href = `${pathname}?${next.toString()}`;
  }, [pathname, searchParams]);

  const handleFilterChange = useCallback((next: FilterState) => {
    navigateWithFilters({
      tab: next.tab === 'newgrad' ? 'newgrad' : null,
      remote: next.remote ? 'true' : null,
      location: next.location || null,
      companyTier: next.companyTier || null,
      gradYear: next.gradYear || null,
      hasSalary: next.hasSalary ? 'true' : null,
      // hideApplied is intentionally excluded — see the render-time filter below.
    });
  }, [navigateWithFilters]);

  // hideApplied depends on which jobs *this browser* has applied to, which the
  // backend has no way to filter by for anonymous users — it stays client-side,
  // applied over the page the server already returned.
  const [hideApplied, setHideApplied] = useState(false);

  const handleSearchChange = useCallback((value: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      navigateWithFilters({ search: value || null });
    }, 400);
  }, [navigateWithFilters]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_REALTIME !== 'true') return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const job = JSON.parse(event.data);
          setConveyorJobs((prev) => [...prev.slice(-19), { jobId: job.jobId, company: job.company, title: job.title }]);
        } catch {}
      };
      ws.onerror = () => {};
      ws.onclose = () => {};
      return () => ws.close();
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getSavedJobs()
      .then((res) => setSavedJobIds(new Set(res.items.map((j) => j.jobId))))
      .catch(() => {});
  }, [isAuthenticated]);

  const handleSaveJob = useCallback(async (jobId: string, save: boolean) => {
    if (!isAuthenticated) return;
    if (save) {
      setSavedJobIds((prev) => new Set(prev).add(jobId));
      try {
        await api.saveJob(jobId);
      } catch {
        setSavedJobIds((prev) => {
          const s = new Set(prev);
          s.delete(jobId);
          return s;
        });
      }
    } else {
      setSavedJobIds((prev) => {
        const s = new Set(prev);
        s.delete(jobId);
        return s;
      });
      try {
        await api.unsaveJob(jobId);
      } catch {
        setSavedJobIds((prev) => new Set(prev).add(jobId));
      }
    }
  }, [isAuthenticated]);

  const handleApply = useCallback((jobId: string) => {
    if (!isAuthenticated) return;
    const job = allJobs.find((j) => j.jobId === jobId);
    if (job) setApplyModal({ jobId, title: job.title, company: job.company, applyUrl: job.applyUrl });
  }, [isAuthenticated, allJobs]);

  const handleApplySuccess = useCallback((jobId: string) => {
    setAppliedJobIds((prev) => new Set(prev).add(jobId));
  }, []);

  // The only filtering left on the client: hideApplied, which can't be done
  // server-side (see above). Everything else — tab, remote, location, search,
  // companyTier, gradYear, hasSalary — was already applied server-side by
  // app/page.tsx against the full dataset, so allJobs is already correct.
  const visibleJobs = hideApplied ? allJobs.filter((job) => !appliedJobIds.has(job.jobId)) : allJobs;

  const hasActiveFilters = filters.remote || !!filters.location || hideApplied ||
    !!filters.companyTier || !!filters.gradYear || filters.hasSalary || !!searchQuery;

  const totalPages = Math.ceil(totalFromApi / pageSize);

  const goToPage = useCallback((targetPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(targetPage));
    // Hard navigation — see the comment in navigateWithFilters for why
    // router.push (even combined with router.refresh()) isn't reliable here.
    window.location.href = `${pathname}?${next.toString()}`;
  }, [pathname, searchParams]);

  return (
    <div className="min-h-screen bg-white">
      <TopBar onSearchFocus={focusSearch} />

      <div className="border-b border-black/8 bg-background px-6 py-6 text-center">
        <h1 className="font-mono text-2xl font-bold text-text-primary sm:text-3xl">
          Intern &amp; New Grad Jobs
        </h1>
        <p className="mt-1 font-mono text-sm text-text-secondary">
          {totalFromApi > 0 ? `${totalFromApi.toLocaleString()} active positions` : 'No jobs found'}
          {lastSync && ` · synced ${formatSyncTime(lastSync)}`}
        </p>
      </div>

      <main className="mx-auto max-w-5xl px-3 sm:px-6">
        {/* Keep the filter/search bar in normal flow (no floating/sticky behavior). */}
        <div className="bg-white">
          <FilterBar
            searchInputRef={searchInputRef}
            filters={{ ...filters, hideApplied }}
            onFilterChange={(f) => {
              setHideApplied(f.hideApplied);
              handleFilterChange(f);
            }}
            initialSearch={searchQuery}
            onSearchChange={handleSearchChange}
          />
        </div>

        <div className="flex items-center justify-between border-b border-black/8 py-2">
          {loading ? (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="font-mono text-xs text-text-tertiary">Loading...</span>
            </div>
          ) : error ? (
            <p className="font-mono text-xs font-bold text-red-600">⚠ {error}</p>
          ) : (
            <p className="font-mono text-xs text-text-secondary">
              {searchQuery ? (
                <><span className="font-bold text-text-primary">{totalFromApi.toLocaleString()}</span> results for "<span className="text-primary">{searchQuery}</span>"</>
              ) : (
                <><span className="font-bold text-text-primary">{totalFromApi.toLocaleString()}</span> {filters.tab === 'intern' ? 'internships' : 'new grad roles'}{hasActiveFilters && !searchQuery ? ' matching filters' : ''}</>
              )}
            </p>
          )}
          {lastSync && !loading && (
            <span className="font-mono text-[10px] text-text-tertiary">
              synced {formatSyncTime(lastSync)}
            </span>
          )}
        </div>

        {visibleJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 text-5xl">{searchQuery ? '🔍' : '📭'}</div>
            <p className="font-mono text-base font-bold text-text-secondary">
              {searchQuery ? `No ${filters.tab === 'intern' ? 'internships' : 'new grad roles'} matching "${searchQuery}"` : `No ${filters.tab === 'intern' ? 'internships' : 'new grad roles'} found`}
            </p>
            <p className="mt-2 font-mono text-sm text-text-tertiary">
              {searchQuery ? 'Try a different search or clear filters' : 'Try switching tabs or removing filters'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  if (searchInputRef.current) searchInputRef.current.value = '';
                  setHideApplied(false);
                  navigateWithFilters({ remote: null, location: null, companyTier: null, gradYear: null, hasSalary: null, search: null });
                }}
                className="mt-5 border-2 border-black bg-primary px-5 py-2 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {visibleJobs.map((job) => (
              <JobListRow
                key={job.jobId}
                jobId={job.jobId}
                company={job.company}
                title={job.title}
                location={job.location}
                employmentType={job.employmentType}
                postedAt={job.postedAt}
                scrapedAt={job.scrapedAt}
                jobStatus={job.jobStatus}
                applyUrl={job.applyUrl}
                matchPercentage={job.matchPercentage}
                companyTier={job.companyTier}
                ghostScore={job.ghostScore}
                experienceLevel={job.experienceLevel}
                entryType={job.entryType}
                gradYearMin={job.gradYearMin}
                gradYearMax={job.gradYearMax}
                salaryRaw={job.salaryRaw}
                alreadyApplied={appliedJobIds.has(job.jobId)}
                isSaved={savedJobIds.has(job.jobId)}
                onApply={isAuthenticated ? handleApply : undefined}
                onSave={isAuthenticated ? handleSaveJob : undefined}
                detailHref={`/jobs/${job.jobId}`}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/8 py-6 pb-20">
            <button
              onClick={() => goToPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="border border-black/20 bg-white px-4 py-2 font-mono text-xs font-bold transition-all hover:border-black/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="font-mono text-xs text-text-secondary">
              Page <span className="font-bold text-text-primary">{page + 1}</span> of {totalPages}
            </span>
            <button
              onClick={() => goToPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="border border-black/20 bg-white px-4 py-2 font-mono text-xs font-bold transition-all hover:border-black/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {applyModal && (
        <ApplyModal
          jobId={applyModal.jobId}
          jobTitle={applyModal.title}
          company={applyModal.company}
          applyUrl={applyModal.applyUrl}
          onClose={() => setApplyModal(null)}
          onSuccess={handleApplySuccess}
        />
      )}

      <ConveyorBelt
        jobs={conveyorJobs}
        onSaveJob={(jobId) => handleSaveJob(jobId, true)}
        visible={conveyorJobs.length > 0}
      />
    </div>
  );
}
