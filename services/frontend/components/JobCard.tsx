'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const COMPANY_DOMAINS: Record<string, string> = {
  'google': 'google.com', 'meta': 'meta.com', 'facebook': 'facebook.com',
  'amazon': 'amazon.com', 'apple': 'apple.com', 'microsoft': 'microsoft.com',
  'netflix': 'netflix.com', 'stripe': 'stripe.com', 'airbnb': 'airbnb.com',
  'uber': 'uber.com', 'lyft': 'lyft.com', 'twitter': 'twitter.com',
  'linkedin': 'linkedin.com', 'salesforce': 'salesforce.com', 'adobe': 'adobe.com',
  'nvidia': 'nvidia.com', 'coinbase': 'coinbase.com', 'doordash': 'doordash.com',
  'robinhood': 'robinhood.com', 'plaid': 'plaid.com', 'databricks': 'databricks.com',
  'figma': 'figma.com', 'notion': 'notion.so', 'discord': 'discord.com',
  'cloudflare': 'cloudflare.com', 'mongodb': 'mongodb.com', 'snowflake': 'snowflake.com',
  'datadog': 'datadoghq.com', 'openai': 'openai.com', 'anthropic': 'anthropic.com',
};

function getCompanyDomain(company: string): string | null {
  const key = company.toLowerCase().trim();
  if (COMPANY_DOMAINS[key]) return COMPANY_DOMAINS[key];
  for (const [k, v] of Object.entries(COMPANY_DOMAINS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  const slug = key.replace(/[^a-z0-9]/g, '');
  return slug.length > 2 ? `${slug}.com` : null;
}

function CompanyLogo({ company }: { company: string }) {
  const [failed, setFailed] = useState(false);
  const domain = getCompanyDomain(company);
  if (!domain || failed) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-text-primary">
        {company.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/8 bg-white">
      <Image
        src={`https://logo.clearbit.com/${domain}`}
        alt={`${company} logo`}
        width={48}
        height={48}
        className="h-10 w-10 object-contain"
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  );
}

interface JobCardProps {
  jobId: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  postedAt: string | null;
  scrapedAt: string;
  matchPercentage?: number | null;
  isSaved?: boolean;
  alreadyApplied?: boolean;
  onSave?: (jobId: string, saved: boolean) => void;
  onApply?: (jobId: string) => void;
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0 || diffMs > 365 * 24 * 60 * 60 * 1000) return '';
  const h = Math.floor(diffMs / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export default memo(function JobCard({
  jobId,
  title,
  company,
  location,
  employmentType,
  postedAt,
  scrapedAt,
  matchPercentage,
  isSaved = false,
  alreadyApplied = false,
  onSave,
  onApply,
}: JobCardProps) {
  const [saved, setSaved] = useState(isSaved);
  const [savePending, setSavePending] = useState(false);
  const timeAgo = formatTimeAgo(postedAt || scrapedAt);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!onSave || savePending) return;
    setSavePending(true);
    const newSaved = !saved;
    setSaved(newSaved);
    try {
      await onSave(jobId, newSaved);
    } catch {
      setSaved(!newSaved);
    } finally {
      setSavePending(false);
    }
  };

  const handleApply = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onApply) onApply(jobId);
  };

  return (
    <Link href={`/jobs/${jobId}`} className="group block">
      <div className="relative overflow-hidden border-2 border-black/8 bg-white p-5 transition-all hover:border-black/20 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
        {/* Match percentage badge */}
        {matchPercentage !== undefined && matchPercentage !== null && (
          <div className="absolute right-3 top-3">
            <div className="border-2 border-primary bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-text-primary">
              {matchPercentage}% MATCH
            </div>
          </div>
        )}

        {/* Header: Logo + Company */}
        <div className="mb-4 flex items-start gap-3">
          <CompanyLogo company={company} />
          <div className="flex-1">
            <h3 className="font-mono text-sm font-bold text-text-primary">{company}</h3>
            {timeAgo && (
              <p className="font-mono text-xs text-text-tertiary">{timeAgo}</p>
            )}
          </div>
        </div>

        {/* Job Title */}
        <h2 className="mb-3 font-mono text-lg font-bold leading-tight text-text-primary group-hover:text-primary">
          {title}
        </h2>

        {/* Meta Info */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="border border-black/20 bg-background px-2 py-1 font-mono text-xs text-text-secondary">
            📍 {location}
          </span>
          <span className="border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-text-primary">
            {employmentType}
          </span>
          {alreadyApplied && (
            <span className="border border-green-400 bg-green-50 px-2 py-1 font-mono text-xs font-bold text-green-700">
              ✓ APPLIED
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onApply && (
            <button
              onClick={handleApply}
              disabled={alreadyApplied}
              className="flex-1 border-2 border-black bg-primary px-4 py-2 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              {alreadyApplied ? 'APPLIED' : 'QUICK APPLY'}
            </button>
          )}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={savePending}
              className="border-2 border-black bg-white px-4 py-2 font-mono text-xs font-bold transition-all hover:bg-background disabled:opacity-40"
              title={saved ? 'Unsave job' : 'Save job'}
            >
              {saved ? '★' : '☆'}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
})
