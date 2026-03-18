'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import MorphingHeader from '@/components/MorphingHeader';
import FilterBar, { FilterState } from '@/components/FolderTabs';
import JobListRow from '@/components/JobListRow';
import ConveyorBelt from '@/components/ConveyorBelt';
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
  scrapedAt: string;
  matchPercentile?: number;
  applyUrl: string;
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [conveyorJobs, setConveyorJobs] = useState<Array<{ jobId: string; company: string; title: string }>>([]);
  const [filters, setFilters] = useState<FilterState>({
    remote: false,
    employmentType: 'all',
    location: '',
    company: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);
  const pageSize = 50;
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection for real-time job updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = process.env.NEXT_PUBLIC_API_URL
      ? `${protocol}//${new URL(process.env.NEXT_PUBLIC_API_URL).host}/ws`
      : `${protocol}//${window.location.host}/ws`;

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
          scrapedAt: item.postedAt,
          matchPercentile: undefined,
          applyUrl: item.applyUrl,
        }));
        
        setJobs(mappedJobs);
        setTotal(data.total);
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

        {/* Job Count */}
        <div className="border-b-2 border-black/10 py-2">
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
            {jobs.map((job) => (
              <JobListRow
                key={job.jobId}
                company={job.company}
                title={job.title}
                location={job.location}
                employmentType={job.employmentType}
                techStack={job.techStack}
                scrapedAt={job.scrapedAt}
                matchPercentile={job.matchPercentile}
                applyUrl={job.applyUrl}
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

      {/* Zero-Day Conveyor Belt */}
      <ConveyorBelt
        jobs={conveyorJobs}
        onSaveJob={handleSaveJob}
        visible={conveyorJobs.length > 0}
      />
    </div>
  );
}
