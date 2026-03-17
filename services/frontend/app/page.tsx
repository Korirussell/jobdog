'use client';

import { useEffect, useState } from 'react';
import MorphingHeader from '@/components/MorphingHeader';
import FilterBar from '@/components/FolderTabs';
import JobListRow from '@/components/JobListRow';
import { api } from '@/lib/api';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useDebounce } from '@/hooks/useDebounce';

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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    async function fetchJobs() {
      try {
        setLoading(true);
        
        // Build query params based on filters
        const params = new URLSearchParams({
          page: page.toString(),
          size: '100',
        });
        
        if (activeFilter === 'remote') {
          params.append('remote', 'true');
        }
        
        if (debouncedSearch) {
          params.append('search', debouncedSearch);
        }
        
        const response = await fetch(`/api/v1/jobs?${params}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch jobs');
        }
        
        const data = await response.json();
        
        // Map backend response to frontend format
        const mappedJobs: Job[] = data.items.map((item: any) => ({
          jobId: item.jobId,
          title: item.title,
          company: item.company,
          location: item.location,
          employmentType: item.employmentType,
          techStack: [], // Backend doesn't provide this yet
          scrapedAt: item.postedAt, // Using actual posted time, not scrape time
          matchPercentile: undefined, // Backend doesn't provide this yet
          applyUrl: item.applyUrl,
        }));
        
        // For page 0 (filter change), replace jobs. For page > 0 (infinite scroll), append
        if (page === 0) {
          setJobs(mappedJobs);
        } else {
          setJobs(prev => [...prev, ...mappedJobs]);
        }
        
        setTotal(data.total);
        setHasMore(mappedJobs.length === 100);
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
  }, [page, activeFilter, debouncedSearch]);

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const loadMoreRef = useInfiniteScroll(loadMore, hasMore, loading);

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      {/* Morphing Header - Hero that transforms into sticky nav */}
      <MorphingHeader />

      {/* Main Content Area - Center-aligned, unbounded */}
      <main id="main-content" className="mx-auto min-h-screen max-w-6xl px-6">
        {/* Filter Bar - Clean dividing line */}
        <FilterBar 
          onFilterChange={(filter) => {
            setActiveFilter(filter);
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
              SHOWING <span className="text-text-primary">{jobs.length}</span> OF{' '}
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

        {/* Infinite Scroll Sentinel */}
        {hasMore && (
          <div ref={loadMoreRef} className="border-t-2 border-black/10 py-8 text-center">
            {loading ? (
              <div className="font-mono text-sm text-text-secondary">
                <span className="animate-pulse">█</span> LOADING_MORE...
              </div>
            ) : (
              <div className="font-mono text-xs text-text-secondary">
                SCROLL_FOR_MORE ▼
              </div>
            )}
          </div>
        )}
        {!hasMore && jobs.length > 0 && (
          <div className="border-t-2 border-black/10 py-8 text-center">
            <p className="font-mono text-xs font-bold uppercase text-text-secondary">
              END_OF_RESULTS
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
