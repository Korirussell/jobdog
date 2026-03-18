'use client';

import { useEffect, useState } from 'react';
import MorphingHeader from '@/components/MorphingHeader';
import AuthGuard from '@/components/AuthGuard';
import JobListRow from '@/components/JobListRow';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface SavedJob {
  jobId: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  postedAt: string | null;
  scrapedAt: string;
  jobStatus: string;
  applyUrl: string;
  savedAt: string;
}

export default function SavedPage() {
  const { isAuthenticated } = useAuth();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    api.getSavedJobs()
      .then((res) => setSavedJobs(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleUnsave = async (jobId: string) => {
    try {
      await api.unsaveJob(jobId);
      setSavedJobs((prev) => prev.filter((j) => j.jobId !== jobId));
    } catch {}
  };

  return (
    <div className="min-h-screen">
      <MorphingHeader />
      <AuthGuard>
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-8">
        <div className="mb-6">
          <h1 className="mb-2 font-mono text-2xl font-bold text-text-primary">
            SAVED_JOBS/
          </h1>
          <p className="font-mono text-sm text-text-secondary">
            Your bookmarked opportunities
          </p>
        </div>

        <div className="border-b-2 border-black/10 py-2">
          <p className="font-mono text-xs font-bold uppercase text-text-secondary">
            SHOWING <span className="text-text-primary">{savedJobs.length}</span> SAVED POSITIONS
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="font-mono text-sm text-text-secondary">
              <span className="animate-pulse">|</span> LOADING_SAVED.EXE
            </div>
          </div>
        ) : savedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="mb-2 font-mono text-sm text-text-secondary">
              NO_SAVED_JOBS.TXT
            </p>
            <p className="text-sm text-text-tertiary">
              Save jobs from the conveyor belt or job listings
            </p>
          </div>
        ) : (
          <div>
            {savedJobs.map((job) => (
              <div key={job.jobId} className="group relative">
                <JobListRow
                  jobId={job.jobId}
                  company={job.company}
                  title={job.title}
                  location={job.location}
                  employmentType={job.employmentType}
                  postedAt={job.postedAt}
                  scrapedAt={job.scrapedAt}
                  jobStatus={job.jobStatus}
                  applyUrl={job.applyUrl}
                />
                <button
                  onClick={() => handleUnsave(job.jobId)}
                  className="absolute right-4 top-4 border-2 border-black/20 bg-white px-2 py-1 font-mono text-xs font-bold text-danger opacity-0 transition-opacity group-hover:opacity-100 hover:border-danger hover:bg-danger/10"
                >
                  UNSAVE
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      </AuthGuard>
    </div>
  );
}
