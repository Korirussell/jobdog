'use client';

import { memo } from 'react';

interface JobListRowProps {
  company: string;
  title: string;
  location: string;
  employmentType: string;
  techStack?: string[];
  scrapedAt: string;
  matchPercentile?: number;
  applyUrl: string;
}

const JobListRow = memo(function JobListRow({
  company,
  title,
  location,
  employmentType,
  techStack = [],
  scrapedAt,
  matchPercentile,
  applyUrl,
}: JobListRowProps) {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'JUST_NOW';
    if (diffInHours < 24) return `${diffInHours}H_AGO`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}D_AGO`;
    return `${Math.floor(diffInDays / 7)}W_AGO`;
  };

  // Check if job is new (< 24 hours from posting)
  const isNew = () => {
    const date = new Date(scrapedAt); // scrapedAt contains postedAt from backend
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    return diffInHours < 24;
  };

  const jobIsNew = isNew();

  return (
    <a
      href={applyUrl}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.open(applyUrl, '_blank', 'noopener,noreferrer');
        }
      }}
      aria-label={`${title} at ${company} - ${location}`}
      className={`
        group flex cursor-pointer items-center gap-4 border-b-2 border-black/10
        py-4 transition-all
        hover:bg-background-secondary
        ${jobIsNew ? 'bg-primary/5' : ''}
      `}
    >
      {/* Selection Indicator */}
      <div className="h-full w-1 bg-transparent transition-colors group-hover:bg-primary" />

      {/* Left: Company & Title */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold uppercase tracking-wide text-secondary">
            {company}
          </span>
          <span className="text-lg font-bold text-text-primary">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs uppercase text-text-secondary">
          <span>📍 {location}</span>
          <span>|</span>
          <span>💼 {employmentType}</span>
        </div>
      </div>

      {/* Middle: Tech Stack Tags */}
      {techStack.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {techStack.slice(0, 4).map((tech) => (
            <span
              key={tech}
              className="
                border-2 border-black/20 bg-gray-100 px-2 py-1
                font-mono text-xs font-bold uppercase text-text-primary
                shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)]
              "
            >
              {tech}
            </span>
          ))}
          {techStack.length > 4 && (
            <span className="font-mono text-xs font-bold text-text-tertiary">
              +{techStack.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Right: Time & Match */}
      <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end sm:gap-1">
        <div className="flex items-center gap-1.5">
          {jobIsNew && (
            <span className="animate-pulse font-mono text-sm font-bold text-primary">
              *
            </span>
          )}
          <span className="font-mono text-xs font-bold uppercase text-text-secondary">
            {formatTimeAgo(scrapedAt)}
          </span>
        </div>
        {matchPercentile !== undefined && (
          <div className="flex items-center gap-1 rounded border-2 border-primary bg-primary-light px-2 py-0.5">
            <span className="font-mono text-sm font-bold text-text-primary">
              {matchPercentile}%
            </span>
            <span className="font-mono text-[10px] font-bold uppercase text-text-secondary">
              MATCH
            </span>
          </div>
        )}
      </div>
    </a>
  );
}, (prevProps, nextProps) => {
  // Only re-render if job data actually changed
  return prevProps.applyUrl === nextProps.applyUrl &&
         prevProps.scrapedAt === nextProps.scrapedAt &&
         prevProps.matchPercentile === nextProps.matchPercentile;
});

export default JobListRow;
