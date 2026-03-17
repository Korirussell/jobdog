'use client';

import { useEffect, useState } from 'react';
import MorphingHeader from '@/components/MorphingHeader';
import { api } from '@/lib/api';

interface Application {
  id: string;
  jobTitle: string;
  company: string;
  appliedAt: string;
  status: string;
  percentile?: number;
  applicantCount?: number;
  isEarlyApplicant?: boolean;
  matchScore?: number;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApplications() {
      try {
        const response = await api.getApplications();
        // Map API response to Application interface
        const mappedApps = response.items.map((item: any) => ({
          id: item.applicationId,
          jobTitle: item.jobTitle,
          company: item.company,
          appliedAt: item.appliedAt,
          status: item.status,
          percentile: item.percentile,
          applicantCount: item.applicantCount,
          isEarlyApplicant: item.benchmarkState === 'EARLY_APPLICANT',
          matchScore: item.matchScore,
        }));
        setApplications(mappedApps);
      } catch (err) {
        console.error('Failed to fetch applications:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchApplications();
  }, []);

  return (
    <div className="min-h-screen">
      <MorphingHeader />
      
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-8">
        <div className="mb-6">
          <h1 className="mb-2 font-mono text-2xl font-bold text-text-primary">
            📋 APPLIED_TRACKER/
          </h1>
          <p className="font-mono text-sm text-text-secondary">
            Track your application status
          </p>
        </div>

        <div className="border-b-2 border-black/10 py-2">
          <p className="font-mono text-xs font-bold uppercase text-text-secondary">
            SHOWING <span className="text-text-primary">{applications.length}</span> APPLICATIONS
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="font-mono text-sm text-text-secondary">
              <span className="animate-pulse">█</span> LOADING_APPLICATIONS.EXE
            </div>
          </div>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 text-6xl">📝</div>
            <p className="font-mono text-sm text-text-secondary">
              NO_APPLICATIONS.LOG
            </p>
            <p className="mt-2 text-sm text-text-tertiary">
              Start applying to jobs to track your progress
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {applications.map((app) => (
              <li
                key={app.id}
                className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-text-primary">
                      {app.jobTitle}
                    </h3>
                    <p className="font-mono text-xs uppercase text-secondary">
                      {app.company}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="mb-1 font-mono text-xs font-bold uppercase text-text-secondary">
                      {app.status}
                    </div>
                    <div className="font-mono text-sm font-bold text-primary">
                      {app.matchScore}% MATCH
                    </div>
                  </div>
                </div>
                <div className="mt-2 font-mono text-xs text-text-tertiary">
                  Applied: {new Date(app.appliedAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
