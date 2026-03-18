'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import TopBar from '@/components/TopBar';
import FilterBar, { FilterState } from '@/components/FolderTabs';
import JobListRow from '@/components/JobListRow';
import ConveyorBelt from '@/components/ConveyorBelt';
import ApplyModal from '@/components/ApplyModal';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface Job {
  jobId: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  techStack?: string[];
  postedAt: string | null;
  scrapedAt: string;
  jobStatus: string;
  matchPercentile?: number;
  applyUrl: string;
}

function formatSyncTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'UNKNOWN';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'JUST_NOW';
  if (diffMins < 60) return `${diffMins}M_AGO`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}H_AGO`;
  return `${Math.floor(diffHours / 24)}D_AGO`;
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [conveyorJobs, setConveyorJobs] = useState<Array<{ jobId: string; company: string; title: string }>>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [applyModal, setApplyModal] = useState<{ jobId: string; title: string; company: string } | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    remote: false,
    employmentType: 'all',
    location: '',
    company: '',
    hideApplied: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  // Instant client-side search on the loaded page — no API round-trip needed
  const [liveSearch, setLiveSearch] = useState('');
  const pageSize = 100;
  const wsRef = useRef<WebSocket | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  // WebSocket connection for real-time job updates
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_REALTIME !== 'true') {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Always connect through the frontend origin so Vercel rewrites/proxy rules apply.
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const job = JSON.parse(event.data);
          setConveyorJobs((prev) => [...prev.slice(-19), {
            jobId: job.jobId,
            company: job.company,
            title: job.title,
          }]);
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {};

      return () => ws.close();
    } catch {
      return;
    }
  }, []);

  const handleSaveJob = useCallback(async (jobId: string) => {
    if (!isAuthenticated) return;
    try {
      await api.saveJob(jobId);
    } catch {}
  }, [isAuthenticated]);

  const handleApply = useCallback((jobId: string) => {
    if (!isAuthenticated) return;
    const job = jobs.find((j) => j.jobId === jobId);
    if (job) {
      setApplyModal({ jobId, title: job.title, company: job.company });
    }
  }, [isAuthenticated, jobs]);

  const handleApplySuccess = useCallback((jobId: string) => {
    setAppliedJobIds((prev) => new Set(prev).add(jobId));
  }, []);

  useEffect(() => {
    async function fetchJobs() {
      try {
        setLoading(true);
        
        const params = new URLSearchParams({
          page: page.toString(),
          size: pageSize.toString(),
        });
        
        if (filters.remote) {
          params.append('remote', 'true');
        }
        
        if (filters.employmentType && filters.employmentType !== 'all') {
          params.append('employmentType', filters.employmentType);
        }
        
        if (filters.location) {
          params.append('location', filters.location);
        }
        
        if (filters.company) {
          params.append('company', filters.company);
        }
        
        if (debouncedSearch) {
          params.append('search', debouncedSearch);
        }
        
        const response = await fetch(`/api/v1/jobs?${params}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch jobs');
        }
        
        const data = await response.json();
        
        const mappedJobs: Job[] = data.items.map((item: any) => ({
          jobId: item.jobId,
          title: item.title,
          company: item.company,
          location: item.location,
          employmentType: item.employmentType,
          techStack: [],
          postedAt: item.postedAt ?? null,
          scrapedAt: item.scrapedAt,
          jobStatus: item.jobStatus ?? 'ACTIVE',
          matchPercentile: undefined,
          applyUrl: item.applyUrl,
        }));

        setJobs(mappedJobs);
        setTotal(data.total);
        if (data.lastSync) setLastSync(data.lastSync);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
        setError('Failed to load jobs from API.');
        setJobs([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, [page, filters, debouncedSearch]);

  const totalPages = Math.ceil(total / pageSize);
  const startResult = page * pageSize + 1;
  const endResult = Math.min((page + 1) * pageSize, total);

  // Client-side filtering: instant search + hideApplied on the loaded page
  const q = liveSearch.trim().toLowerCase();
  const visibleJobs = jobs.filter((job) => {
    if (filters.hideApplied && appliedJobIds.has(job.jobId)) return false;
    if (!q) return true;
    return (
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen">
      <TopBar onSearchFocus={focusSearch} />

      {/* Hero banner — compact, always below the nav */}
      <div className="border-b-2 border-black/10 bg-background px-6 py-8 text-center">
        <h1 className="mb-1 font-mono text-2xl font-bold text-text-primary sm:text-3xl">
          Intern &amp; New Grad Jobs
        </h1>
        <p className="font-mono text-sm text-text-secondary">
          {total > 0 ? `${total.toLocaleString()} active positions` : 'Loading positions...'} · updated {lastSync ? formatSyncTime(lastSync) : 'recently'}
        </p>
      </div>

      {/* Main Content Area */}
      <main id="main-content" className="mx-auto min-h-screen max-w-6xl px-6">
        {/* Filter Bar */}
        <FilterBar
          searchInputRef={searchInputRef}
          onFilterChange={(newFilters) => {
            setFilters(newFilters);
            setPage(0);
          }}
          onSearchChange={(search) => {
            // Instant client-side filter on current page
            setLiveSearch(search);
            // Also trigger API fetch (debounced) for cross-page results
            setSearchQuery(search);
            setPage(0);
          }}
        />

        {/* Job Count + Last Sync */}
        <div className="flex items-center justify-between border-b-2 border-black/10 py-2">
          {loading ? (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <p className="font-mono text-xs font-bold uppercase text-text-secondary">
                LOADING POSITIONS...
              </p>
            </div>
          ) : error ? (
            <p className="font-mono text-xs font-bold uppercase text-red-600">
              ⚠ {error}
            </p>
          ) : (
            <p className="font-mono text-xs font-bold uppercase text-text-secondary">
              {q ? (
                <>
                  <span className="text-text-primary">{visibleJobs.length}</span> results for{' '}
                  <span className="text-primary">"{liveSearch}"</span>
                </>
              ) : (
                <>
                  SHOWING <span className="text-text-primary">{startResult}–{endResult}</span> OF{' '}
                  <span className="text-text-primary">{total.toLocaleString()}</span> POSITIONS
                </>
              )}
            </p>
          )}
          {lastSync && !loading && (
            <p className="font-mono text-xs text-text-tertiary" title={new Date(lastSync).toLocaleString()}>
              synced {formatSyncTime(lastSync)}
            </p>
          )}
        </div>

        {/* Job Rows */}
        {loading ? (
          // Skeleton loading — 8 placeholder rows
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border-b-2 border-black/10 px-4 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="h-5 w-32 animate-pulse rounded bg-black/8" />
                    <div className="h-4 w-64 animate-pulse rounded bg-black/5" />
                  </div>
                  <div className="h-4 w-16 animate-pulse rounded bg-black/5" />
                </div>
                <div className="mt-3 flex gap-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-black/5" />
                  <div className="h-3 w-20 animate-pulse rounded bg-black/5" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 text-4xl">{q ? '🔍' : '📭'}</div>
            <p className="font-mono text-base font-bold text-text-secondary">
              {q ? `No jobs matching "${liveSearch}"` : 'No jobs found'}
            </p>
            <p className="mt-2 font-mono text-sm text-text-tertiary">
              {q ? 'Try a different search term or clear filters' : 'Check back soon — jobs are updated regularly'}
            </p>
            {q && (
              <button
                onClick={() => { setLiveSearch(''); setSearchQuery(''); if (searchInputRef.current) searchInputRef.current.value = ''; }}
                className="mt-4 border-2 border-black bg-primary px-4 py-2 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              >
                Clear search
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
                techStack={job.techStack}
                postedAt={job.postedAt}
                scrapedAt={job.scrapedAt}
                jobStatus={job.jobStatus}
                matchPercentile={job.matchPercentile}
                applyUrl={job.applyUrl}
                alreadyApplied={appliedJobIds.has(job.jobId)}
                onApply={isAuthenticated ? handleApply : undefined}
              />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t-2 border-black/10 py-6 pb-24">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="
                  border-2 border-black/20 bg-white px-4 py-2
                  font-mono text-xs font-bold uppercase text-text-primary
                  transition-all hover:border-black hover:bg-background-secondary
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                ← PREV
              </button>
              
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-secondary">
                  PAGE
                </span>
                <span className="font-mono text-sm font-bold text-text-primary">
                  {page + 1}
                </span>
                <span className="font-mono text-xs text-text-secondary">
                  OF {totalPages}
                </span>
              </div>
              
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="
                  border-2 border-black/20 bg-white px-4 py-2
                  font-mono text-xs font-bold uppercase text-text-primary
                  transition-all hover:border-black hover:bg-background-secondary
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                NEXT →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Apply Modal */}
      {applyModal && (
        <ApplyModal
          jobId={applyModal.jobId}
          jobTitle={applyModal.title}
          company={applyModal.company}
          onClose={() => setApplyModal(null)}
          onSuccess={handleApplySuccess}
        />
      )}

      {/* Zero-Day Conveyor Belt */}
      <ConveyorBelt
        jobs={conveyorJobs}
        onSaveJob={handleSaveJob}
        visible={conveyorJobs.length > 0}
      />
    </div>
  );
}
