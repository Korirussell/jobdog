'use client';

import { useEffect, useState } from 'react';
import MorphingHeader from '@/components/MorphingHeader';
import JobListRow from '@/components/JobListRow';

export default function SavedPage() {
  const [savedJobs, setSavedJobs] = useState<any[]>([]);

  return (
    <div className="min-h-screen">
      <MorphingHeader />
      
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-8">
        <div className="mb-6">
          <h1 className="mb-2 font-mono text-2xl font-bold text-text-primary">
            📁 SAVED_JOBS/
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

        {savedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 text-6xl">📂</div>
            <p className="font-mono text-sm text-text-secondary">
              NO_SAVED_JOBS.TXT
            </p>
            <p className="mt-2 text-sm text-text-tertiary">
              Start saving jobs to build your collection
            </p>
          </div>
        ) : (
          <div>
            {savedJobs.map((job) => (
              <JobListRow key={job.jobId} {...job} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
