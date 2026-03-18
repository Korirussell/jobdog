'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import MorphingHeader from '@/components/MorphingHeader';
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
  const debouncedSearch = useDebounce(searchQuery, 500);
  const pageSize = 50;
  const wsRef = useRef<WebSocket | null>(null);

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

  return (
    <div className="min-h-screen">
      {/* Morphing Header - Hero that transforms into sticky nav */}
      <MorphingHeader />

      {/* Main Content Area - Center-aligned, unbounded */}
      <main id="main-content" className="mx-auto min-h-screen max-w-6xl px-6">
        {/* Filter Bar - Clean dividing line */}
        <FilterBar 
          onFilterChange={(newFilters) => {
            setFilters(newFilters);
            setPage(0); // Reset to first page when filter changes
          }}
          onSearchChange={(search) => {
            setSearchQuery(search);
            setPage(0); // Reset to first page when search changes
          }}
        />

        {/* Job Count + Last Sync */}
        <div className="flex items-center justify-between border-b-2 border-black/10 py-2">
          {loading ? (
            <p className="font-mono text-xs font-bold uppercase text-text-secondary">
              LOADING POSITIONS...
            </p>
          ) : error ? (
            <p className="font-mono text-xs font-bold uppercase text-secondary">
              ⚠ {error}
            </p>
          ) : (
            <p className="font-mono text-xs font-bold uppercase text-text-secondary">
              SHOWING <span className="text-text-primary">{startResult}-{endResult}</span> OF{' '}
              <span className="text-text-primary">{total}</span> POSITIONS
            </p>
          )}
          {lastSync && !loading && (
            <p className="font-mono text-xs text-text-tertiary" title={new Date(lastSync).toLocaleString()}>
              LAST_SYNC: {formatSyncTime(lastSync)}
            </p>
          )}
        </div>

        {/* Job Rows - Unbounded, continuous list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="font-mono text-sm text-text-secondary">
              <span className="animate-pulse">█</span> FETCHING_JOBS.EXE
            </div>
          </div>
        ) : (
          <div>
            {jobs
              .filter((job) => !(filters.hideApplied && appliedJobIds.has(job.jobId)))
              .map((job) => (
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
