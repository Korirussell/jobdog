'use client';

import { useEffect, useState } from 'react';
import MorphingHeader from '@/components/MorphingHeader';
import TaskManager from '@/components/TaskManager';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Application {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  status: string;
  matchScore: number;
  percentile: number | null;
  applicantCount: number;
  appliedAt: string;
}

export default function ApplicationsPage() {
  const { isAuthenticated } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    api.getApplications()
      .then((response) => {
        setApplications(response.items.map((item) => ({
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleKill = (applicationId: string) => {
    setApplications((prev) =>
      prev.map((app) =>
        app.applicationId === applicationId
          ? { ...app, status: 'KILLED' }
          : app
      )
    );
  };

  return (
    <div className="min-h-screen">
      <MorphingHeader />
      
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="font-mono text-sm text-text-secondary">
              <span className="animate-pulse">|</span> LOADING_PROCESSES.EXE
            </div>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="font-mono text-sm text-text-secondary">LOGIN_REQUIRED.ERR</p>
            <a href="/login" className="mt-4 border-2 border-black bg-primary px-6 py-3 font-mono text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              LOGIN.EXE
            </a>
          </div>
        ) : (
          <TaskManager
            applications={applications}
            onKill={handleKill}
          />
        )}
      </main>
    </div>
  );
}
