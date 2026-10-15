'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api, type ReportVerdict } from '@/lib/api';
import ReportControls from '@/components/ReportControls';

interface JobDetailApplyButtonProps {
  jobId: string;
  applyUrl: string;
}

// Apply means "take me to the real job" — see the comment on handleApply in
// HomePageClient.tsx for the full rationale. Same pattern here: a plain link
// to the real posting, plus a best-effort background application record
// when there's exactly one parsed resume to attach it to unambiguously.
export default function JobDetailApplyButton({ jobId, applyUrl }: JobDetailApplyButtonProps) {
  const { isAuthenticated, applyCredits } = useAuth();
  const [parsedResumeId, setParsedResumeId] = useState<string | null>(null);
  const [tracked, setTracked] = useState(false);
  const [opened, setOpened] = useState(false);
  const [verdict, setVerdict] = useState<ReportVerdict | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getResumes()
      .then((res) => {
        const parsed = res.items.filter((r) => r.status === 'PARSED');
        if (parsed.length === 1) setParsedResumeId(parsed[0].resumeId);
      })
      .catch(() => {});
    api.getMyJobReports()
      .then((mine) => setVerdict(mine[jobId] ?? null))
      .catch(() => {});
  }, [isAuthenticated, jobId]);

  const handleClick = () => {
    setOpened(true);
    if (tracked || !parsedResumeId) return;
    setTracked(true);
    api.createApplication(jobId, parsedResumeId).catch(() => setTracked(false));
  };

  const handleReport = async (next: ReportVerdict) => {
    const previous = verdict;
    setVerdict(next);
    try {
      const result = await api.reportJob(jobId, next);
      applyCredits(result.resumeCredits, result.reportsToNextCredit);
      setNotice(
        result.jobClosed ? 'Thanks. Enough people reported this one, so it has been removed.'
          : result.earnedCredit ? 'Thanks. You earned a resume upload.'
          : `Thanks. ${result.reportsToNextCredit} more to earn a resume upload.`,
      );
    } catch {
      setVerdict(previous);
      setNotice('Could not send that. Try again.');
    }
  };

  return (
    <div className="space-y-3">
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="block w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      >
        Apply ↗
      </a>
      {isAuthenticated && opened && (
        <div className="flex flex-col items-center gap-1">
          <ReportControls verdict={verdict} prompt={opened} onReport={handleReport} />
          {notice && <p className="font-mono text-[10px] text-text-secondary">{notice}</p>}
        </div>
      )}
    </div>
  );
}
