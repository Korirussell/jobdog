'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import AuthGuard from '@/components/AuthGuard';
import ApplicationTracker, { ApplicationRow } from '@/components/ApplicationTracker';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function ApplicationsPage() {
  const { isAuthenticated } = useAuth();
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    api.getApplications()
      .then((items) => {
        setApplications(items.map((item) => ({
          applicationId: item.applicationId,
          jobId: item.jobId,
          jobTitle: item.jobTitle,
          company: item.company,
          status: item.status,
          matchScore: item.matchScore ?? 0,
          percentile: item.percentile ?? null,
          applicantCount: item.applicantCount ?? 0,
          appliedAt: item.appliedAt,
        })));
      })
      .catch(() => setError('Failed to load applications.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <AuthGuard>
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
          {/* Header */}
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h1 className="font-mono text-2xl font-bold text-text-primary">Applications</h1>
              <p className="mt-1 font-mono text-sm text-text-secondary">
                Track every application like a pro — your personal intern spreadsheet.
              </p>
            </div>
            <a
              href="/"
              className="border-2 border-black bg-primary px-4 py-2 font-mono text-xs font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
            >
              + Browse Jobs
            </a>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded bg-black/5" />
              ))}
            </div>
          ) : error ? (
            <div className="border-2 border-red-200 bg-red-50 p-6 text-center">
              <p className="font-mono text-sm font-bold text-red-700">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 font-mono text-xs text-red-600 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <ApplicationTracker applications={applications} />
          )}
        </main>
      </AuthGuard>
    </div>
  );
}
