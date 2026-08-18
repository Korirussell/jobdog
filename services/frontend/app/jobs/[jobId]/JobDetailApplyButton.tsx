'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface JobDetailApplyButtonProps {
  jobId: string;
  applyUrl: string;
}

// Apply means "take me to the real job" — see the comment on handleApply in
// HomePageClient.tsx for the full rationale. Same pattern here: a plain link
// to the real posting, plus a best-effort background application record
// when there's exactly one parsed resume to attach it to unambiguously.
export default function JobDetailApplyButton({ jobId, applyUrl }: JobDetailApplyButtonProps) {
  const { isAuthenticated } = useAuth();
  const [parsedResumeId, setParsedResumeId] = useState<string | null>(null);
  const [tracked, setTracked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getResumes()
      .then((res) => {
        const parsed = res.items.filter((r) => r.status === 'PARSED');
        if (parsed.length === 1) setParsedResumeId(parsed[0].resumeId);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const handleClick = () => {
    if (tracked || !parsedResumeId) return;
    setTracked(true);
    api.createApplication(jobId, parsedResumeId).catch(() => setTracked(false));
  };

  return (
    <a
      href={applyUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="block w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
    >
      Apply ↗
    </a>
  );
}
