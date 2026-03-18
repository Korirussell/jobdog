'use client';

import { memo } from 'react';

interface JobListRowProps {
  jobId: string;
  company: string;
  title: string;
  location: string;
  employmentType: string;
  techStack?: string[];
  postedAt: string | null;
  scrapedAt: string;
  jobStatus?: string;
  matchPercentile?: number;
  applyUrl: string;
  alreadyApplied?: boolean;
  onApply?: (jobId: string) => void;
}

function formatTimeAgo(dateString: string | null | undefined): { label: string; isEstimate: boolean } {
  if (!dateString) return { label: 'UNKNOWN', isEstimate: false };

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return { label: 'UNKNOWN', isEstimate: false };

  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();

  if (diffInMs < 0) return { label: 'UNKNOWN', isEstimate: false };
  if (diffInMs > 365 * 24 * 60 * 60 * 1000) return { label: 'UNKNOWN', isEstimate: false };

  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

  if (diffInHours < 1) return { label: 'JUST_NOW', isEstimate: false };
  if (diffInHours < 24) return { label: `${diffInHours}H_AGO`, isEstimate: false };
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return { label: `${diffInDays}D_AGO`, isEstimate: false };
  if (diffInDays < 30) return { label: `${Math.floor(diffInDays / 7)}W_AGO`, isEstimate: false };
  return { label: `${Math.floor(diffInDays / 30)}M_AGO`, isEstimate: false };
}

const JobListRow = memo(function JobListRow({
  jobId,
  company,
  title,
  location,
  employmentType,
  techStack = [],
  postedAt,
  scrapedAt,
  jobStatus,
  matchPercentile,
  applyUrl,
  alreadyApplied = false,
  onApply,
}: JobListRowProps) {
  // Use postedAt for display if available; fall back to scrapedAt but mark as estimate
  const displayDate = postedAt || null;
  const { label: timeLabel, isEstimate } = formatTimeAgo(displayDate);
  const discoveredLabel = formatTimeAgo(scrapedAt).label;

  const isNew = (() => {
    const d = postedAt ? new Date(postedAt) : new Date(scrapedAt);
    if (isNaN(d.getTime())) return false;
    return (Date.now() - d.getTime()) < 24 * 60 * 60 * 1000;
  })();

  const isClosed = jobStatus === 'CLOSED';
  const canApply = !isClosed && !alreadyApplied;

  return (
    <div
      className={`
        group relative flex items-center gap-4 border-b border-black/8
        px-4 py-4 transition-colors
        hover:bg-black/[0.02]
        ${isNew ? 'border-l-[3px] border-l-primary' : ''}
        ${isClosed ? 'opacity-50' : ''}
      `}
    >
      {/* NEW pulse dot */}
      {isNew && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        </span>
      )}

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Company + title */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-sm font-bold text-text-primary">{company}</span>
          <span className="text-black/20">·</span>
          <span className="font-mono text-sm text-text-secondary">{title}</span>
        </div>

        {/* Meta row */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-text-tertiary">
          <span>{location}</span>
          <span className="text-black/20">·</span>
          <span>{employmentType}</span>
          {alreadyApplied && (
            <>
              <span className="text-black/20">·</span>
              <span className="font-bold text-emerald-600">✓ applied</span>
            </>
          )}
          {isClosed && (
            <>
              <span className="text-black/20">·</span>
              <span className="font-bold text-red-500">closed</span>
            </>
          )}
        </div>
      </div>

      {/* Right side: time + actions */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Time */}
        <span
          className="hidden font-mono text-xs text-text-tertiary sm:block"
          title={!postedAt ? `Discovered: ${discoveredLabel}` : undefined}
        >
          {isClosed ? '' : (!postedAt ? `~${discoveredLabel}` : timeLabel)}
        </span>

        {/* Match badge */}
        {matchPercentile !== undefined && (
          <span className="border border-primary bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-text-primary">
            {matchPercentile}% match
          </span>
        )}

        {/* Apply button */}
        {onApply && canApply && (
          <button
            onClick={(e) => { e.stopPropagation(); onApply(jobId); }}
            className="border-2 border-black bg-primary px-3 py-1 font-mono text-xs font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          >
            Apply
          </button>
        )}

        {/* View link */}
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="border border-black/15 bg-white px-3 py-1 font-mono text-xs font-bold text-text-secondary transition-all hover:border-black/40 hover:text-text-primary"
        >
          View ↗
        </a>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.applyUrl === nextProps.applyUrl &&
    prevProps.postedAt === nextProps.postedAt &&
    prevProps.scrapedAt === nextProps.scrapedAt &&
    prevProps.matchPercentile === nextProps.matchPercentile &&
    prevProps.alreadyApplied === nextProps.alreadyApplied &&
    prevProps.jobStatus === nextProps.jobStatus
  );
});

export default JobListRow;
