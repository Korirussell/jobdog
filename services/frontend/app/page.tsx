'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import TopBar from '@/components/TopBar';
import FilterBar, { FilterState } from '@/components/FolderTabs';
import JobListRow from '@/components/JobListRow';
import ConveyorBelt from '@/components/ConveyorBelt';
import ApplyModal from '@/components/ApplyModal';
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
  if (isNaN(date.getTime())) return 'recently';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

const PAGE_SIZE = 100;

export default function Home() {
  const { isAuthenticated } = useAuth();

  // All jobs fetched from API — no filter params sent, filtering is client-side
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFromApi, setTotalFromApi] = useState(0);
  const [page, setPage] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [applyModal, setApplyModal] = useState<{ jobId: string; title: string; company: string } | null>(null);
  const [conveyorJobs, setConveyorJobs] = useState<Array<{ jobId: string; company: string; title: string }>>([]);

  // Client-side filter + search state
  const [filters, setFilters] = useState<FilterState>({
    tab: 'intern',
    remote: false,
    location: '',
    hideApplied: false,
  });
  const [searchQuery, setSearchQuery] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  // WebSocket for live conveyor belt (optional)
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
    } catch { return; }
  }, []);

  const handleSaveJob = useCallback(async (jobId: string) => {
    if (!isAuthenticated) return;
    try { await api.saveJob(jobId); } catch {}
  }, [isAuthenticated]);

  const handleApply = useCallback((jobId: string) => {
    if (!isAuthenticated) return;
    const job = allJobs.find((j) => j.jobId === jobId);
    if (job) setApplyModal({ jobId, title: job.title, company: job.company });
  }, [isAuthenticated, allJobs]);

  const handleApplySuccess = useCallback((jobId: string) => {
    setAppliedJobIds((prev) => new Set(prev).add(jobId));
  }, []);

  // Fetch jobs — NO filter params, pure pagination only
  useEffect(() => {
    let cancelled = false;
    async function fetchJobs() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          size: PAGE_SIZE.toString(),
        });
        const response = await fetch(`/api/v1/jobs?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        setAllJobs(data.items.map((item: any) => ({
          jobId: item.jobId,
          title: item.title,
          company: item.company,
          location: item.location ?? '',
          employmentType: item.employmentType ?? '',
          techStack: [],
          postedAt: item.postedAt ?? null,
          scrapedAt: item.scrapedAt,
          jobStatus: item.jobStatus ?? 'ACTIVE',
          applyUrl: item.applyUrl,
        })));
        setTotalFromApi(data.total);
        if (data.lastSync) setLastSync(data.lastSync);
        setError(null);
      } catch (err: any) {
        if (!cancelled) {
          setError('Could not load jobs. Is the backend running?');
          setAllJobs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchJobs();
    return () => { cancelled = true; };
  }, [page]);

  // ── Pure client-side filtering ──
  const q = searchQuery.trim().toLowerCase();

  const visibleJobs = allJobs.filter((job) => {
    // Tab filter: intern vs new grad
    const type = (job.employmentType ?? '').toUpperCase();
    if (filters.tab === 'intern') {
      // Show jobs that are internships OR have "intern" in the title
      const isIntern = type === 'INTERNSHIP' || job.title.toLowerCase().includes('intern');
      if (!isIntern) return false;
    } else {
      // New Grad: exclude pure internships, keep full-time / new grad roles
      const isIntern = type === 'INTERNSHIP' && !job.title.toLowerCase().includes('new grad');
      if (isIntern) return false;
    }

    // Remote filter
    if (filters.remote && !job.location.toLowerCase().includes('remote')) return false;

    // Location text filter
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      if (!job.location.toLowerCase().includes(loc)) return false;
    }

    // Hide applied
    if (filters.hideApplied && appliedJobIds.has(job.jobId)) return false;

    // Search
    if (q) {
      const haystack = `${job.title} ${job.company} ${job.location}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(totalFromApi / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-white">
      <TopBar onSearchFocus={focusSearch} />

      {/* Hero */}
      <div className="border-b border-black/8 bg-background px-6 py-6 text-center">
        <h1 className="font-mono text-2xl font-bold text-text-primary sm:text-3xl">
          Intern &amp; New Grad Jobs
        </h1>
        <p className="mt-1 font-mono text-sm text-text-secondary">
          {totalFromApi > 0 ? `${totalFromApi.toLocaleString()} active positions` : 'Loading...'}
          {lastSync && ` · synced ${formatSyncTime(lastSync)}`}
        </p>
      </div>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Filter bar */}
        <div className="sticky top-16 z-40 bg-white">
          <FilterBar
            searchInputRef={searchInputRef}
            onFilterChange={(f) => { setFilters(f); }}
            onSearchChange={(s) => { setSearchQuery(s); }}
          />
        </div>

        {/* Result count */}
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
              {q ? (
                <><span className="font-bold text-text-primary">{visibleJobs.length}</span> results for "<span className="text-primary">{searchQuery}</span>"</>
              ) : (
                <><span className="font-bold text-text-primary">{visibleJobs.length}</span> {filters.tab === 'intern' ? 'internships' : 'new grad roles'} on this page</>
              )}
            </p>
          )}
          {lastSync && !loading && (
            <span className="font-mono text-[10px] text-text-tertiary">
              synced {formatSyncTime(lastSync)}
            </span>
          )}
        </div>

        {/* Job list */}
        {loading ? (
          // Skeleton
          <div>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="border-b border-black/8 px-4 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-1 flex-col gap-2.5">
                    <div className="h-4 w-36 animate-pulse rounded bg-black/8" />
                    <div className="h-3.5 w-56 animate-pulse rounded bg-black/5" />
                    <div className="h-3 w-44 animate-pulse rounded bg-black/4" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-7 w-16 animate-pulse rounded bg-black/5" />
                    <div className="h-7 w-14 animate-pulse rounded bg-black/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 text-5xl">{q ? '🔍' : '📭'}</div>
            <p className="font-mono text-base font-bold text-text-secondary">
              {q ? `No ${filters.tab === 'intern' ? 'internships' : 'new grad roles'} matching "${searchQuery}"` : `No ${filters.tab === 'intern' ? 'internships' : 'new grad roles'} found`}
            </p>
            <p className="mt-2 font-mono text-sm text-text-tertiary">
              {q ? 'Try a different search or clear filters' : 'Try switching tabs or removing filters'}
            </p>
            {(q || filters.remote || filters.location) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  if (searchInputRef.current) searchInputRef.current.value = '';
                  setFilters({ tab: filters.tab, remote: false, location: '', hideApplied: false });
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

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/8 py-6 pb-20">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="border border-black/20 bg-white px-4 py-2 font-mono text-xs font-bold transition-all hover:border-black/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="font-mono text-xs text-text-secondary">
              Page <span className="font-bold text-text-primary">{page + 1}</span> of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="border border-black/20 bg-white px-4 py-2 font-mono text-xs font-bold transition-all hover:border-black/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
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

      {/* Conveyor Belt */}
      <ConveyorBelt
        jobs={conveyorJobs}
        onSaveJob={handleSaveJob}
        visible={conveyorJobs.length > 0}
      />
    </div>
  );
}
