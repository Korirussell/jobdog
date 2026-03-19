'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

export default function HomePageClient({ initialJobs, initialTotal, initialLastSync, initialPage, pageSize }: HomePageClientProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [allJobs] = useState<JobSummary[]>(initialJobs);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const [totalFromApi] = useState(initialTotal);
  const [page] = useState(initialPage);
  const [lastSync] = useState<string | null>(initialLastSync);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [applyModal, setApplyModal] = useState<{ jobId: string; title: string; company: string; applyUrl: string } | null>(null);
  const [conveyorJobs, setConveyorJobs] = useState<Array<{ jobId: string; company: string; title: string }>>([]);
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

  const q = searchQuery.trim().toLowerCase();

  const visibleJobs = allJobs.filter((job) => {
    const type = (job.employmentType ?? '').toUpperCase();
    if (filters.tab === 'intern') {
      const isIntern = type === 'INTERNSHIP' || job.title.toLowerCase().includes('intern');
      if (!isIntern) return false;
    } else {
      const isIntern = type === 'INTERNSHIP' && !job.title.toLowerCase().includes('new grad');
      if (isIntern) return false;
    }

    if (filters.remote && !job.location.toLowerCase().includes('remote')) return false;

    if (filters.location) {
      const loc = filters.location.toLowerCase();
      if (!job.location.toLowerCase().includes(loc)) return false;
    }

    if (filters.hideApplied && appliedJobIds.has(job.jobId)) return false;

    if (q) {
      const haystack = `${job.title} ${job.company} ${job.location}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(totalFromApi / pageSize);

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
        <div className="sticky top-14 z-40 border-b-2 border-black bg-white shadow-[0_4px_0px_0px_rgba(0,0,0,1)] sm:top-16">
          <FilterBar
            searchInputRef={searchInputRef}
            onFilterChange={(f) => { setFilters(f); }}
            onSearchChange={(s) => { setSearchQuery(s); }}
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

        {visibleJobs.length === 0 ? (
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
                postedAt={job.postedAt}
                scrapedAt={job.scrapedAt}
                jobStatus={job.jobStatus}
                applyUrl={job.applyUrl}
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
              onClick={() => router.push(`/?page=${Math.max(0, page - 1)}`)}
              disabled={page === 0}
              className="border border-black/20 bg-white px-4 py-2 font-mono text-xs font-bold transition-all hover:border-black/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="font-mono text-xs text-text-secondary">
              Page <span className="font-bold text-text-primary">{page + 1}</span> of {totalPages}
            </span>
            <button
              onClick={() => router.push(`/?page=${Math.min(totalPages - 1, page + 1)}`)}
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
