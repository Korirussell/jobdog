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
        group flex flex-col gap-3 border-b-2 border-black/10
        px-4 py-5 transition-all
        hover:border-black/20 hover:bg-background-secondary
        ${isNew ? 'border-l-4 border-l-primary bg-primary/5' : ''}
        ${isClosed ? 'opacity-60' : ''}
      `}
    >
      {/* Top Row: Company & Metadata */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-xl font-bold text-text-primary">
            {company}
          </h3>
          <p className="font-mono text-sm font-medium text-text-secondary">
            {title}
          </p>
        </div>

        {/* Right: Time & Match Badge */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            {isNew && (
              <span className="animate-pulse font-mono text-sm font-bold text-primary">*</span>
            )}
            {isClosed ? (
              <span className="font-mono text-xs font-bold uppercase text-danger">CLOSED</span>
            ) : (
              <span
                className="font-mono text-xs font-bold uppercase text-text-secondary"
                title={!postedAt ? `Discovered: ${discoveredLabel}` : undefined}
              >
                {!postedAt ? `~${discoveredLabel}` : timeLabel}
                {!postedAt && timeLabel !== 'UNKNOWN' && (
                  <span className="ml-0.5 text-text-tertiary" title="Estimated from discovery date">~</span>
                )}
              </span>
            )}
          </div>
          {matchPercentile !== undefined && (
            <div className="flex items-center gap-1 rounded border-2 border-primary bg-primary-light px-2 py-0.5">
              <span className="font-mono text-sm font-bold text-text-primary">{matchPercentile}%</span>
              <span className="font-mono text-[10px] font-bold uppercase text-text-secondary">MATCH</span>
            </div>
          )}
          {alreadyApplied && (
            <span className="font-mono text-[10px] font-bold uppercase text-success">✓ APPLIED</span>
          )}
        </div>
      </div>

      {/* Bottom Row: Location, Type, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 font-mono text-xs uppercase text-text-secondary">
          <span className="flex items-center gap-1">
            <span>📍</span>
            <span>{location}</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <span>💼</span>
            <span>{employmentType}</span>
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onApply && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (canApply) onApply(jobId);
              }}
              disabled={!canApply}
              title={
                isClosed ? 'This position is no longer active'
                : alreadyApplied ? 'You have already applied'
                : 'Track this application'
              }
              className={`
                border-2 px-3 py-1 font-mono text-xs font-bold uppercase
                transition-all
                ${canApply
                  ? 'border-black bg-primary text-text-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                  : 'cursor-not-allowed border-black/20 bg-background text-text-tertiary'
                }
              `}
            >
              {alreadyApplied ? '✓ APPLIED' : isClosed ? 'CLOSED' : '> APPLY'}
            </button>
          )}
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`View ${title} at ${company} on company site`}
            className="
              border-2 border-black/20 bg-white px-3 py-1
              font-mono text-xs font-bold uppercase text-text-secondary
              transition-all hover:border-black hover:text-text-primary
            "
          >
            VIEW ↗
          </a>
        </div>
      </div>

      {/* Tech Stack Tags */}
      {techStack.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {techStack.slice(0, 5).map((tech) => (
            <span
              key={tech}
              className="
                border-2 border-black/20 bg-white px-2 py-1
                font-mono text-xs font-bold uppercase text-text-primary
                shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)]
              "
            >
              {tech}
            </span>
          ))}
          {techStack.length > 5 && (
            <span className="font-mono text-xs font-bold text-text-tertiary">
              +{techStack.length - 5}
            </span>
          )}
        </div>
      )}
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
