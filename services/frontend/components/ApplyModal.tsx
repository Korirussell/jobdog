'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Resume {
  resumeId: string;
  label: string;
  originalFilename: string;
  status: string;
}

interface ApplyModalProps {
  jobId: string;
  jobTitle: string;
  company: string;
  applyUrl: string;
  onClose: () => void;
  onSuccess: (jobId: string) => void;
}

function PercentileRing({ percentile }: { percentile: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let n = 0;
    const step = Math.ceil(percentile / 30);
    const t = setInterval(() => {
      n = Math.min(n + step, percentile);
      setDisplay(n);
      if (n >= percentile) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [percentile]);

  const size = 100;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (display / 100) * circ;
  const color = percentile >= 70 ? '#10B981' : percentile >= 40 ? '#F59E0B' : '#EF4444';
  const label = percentile >= 80 ? 'Top candidate' : percentile >= 60 ? 'Above average' : percentile >= 40 ? 'Average' : 'Below average';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={50} cy={50} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
          <circle
            cx={50} cy={50} r={r} fill="none"
            stroke={color} strokeWidth={8}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.3s ease' }}
          />
        </svg>
        <div className="absolute text-center">
          <p className="font-mono text-2xl font-bold leading-none" style={{ color }}>
            {display}
            <span className="text-xs text-text-tertiary">%</span>
          </p>
          <p className="font-mono text-[9px] text-text-tertiary">ile</p>
        </div>
      </div>
      <p className="font-mono text-xs font-bold" style={{ color }}>{label}</p>
    </div>
  );
}

export default function ApplyModal({ jobId, jobTitle, company, applyUrl, onClose, onSuccess }: ApplyModalProps) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    matchScore: number;
    percentile: number | null;
    benchmarkState: string;
    earlyApplicantMessage: string | null;
  } | null>(null);

  useEffect(() => {
    api.getResumes()
      .then((res) => {
        setResumes(res.items);
        const firstParsed = res.items.find((r) => r.status === 'PARSED');
        if (firstParsed) setSelectedResumeId(firstParsed.resumeId);
      })
      .catch(() => setError('Failed to load resumes.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!selectedResumeId) { setError('Please select a resume.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.createApplication(jobId, selectedResumeId);
      setResult({
        matchScore: res.matchScore,
        percentile: res.percentile ?? null,
        benchmarkState: res.benchmarkState,
        earlyApplicantMessage: res.earlyApplicantMessage ?? null,
      });
      onSuccess(jobId);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasParsed = resumes.some((r) => r.status === 'PARSED');
  const selectedResumeName = resumes.find((r) => r.resumeId === selectedResumeId);
  const displayName = selectedResumeName
    ? (selectedResumeName.label !== 'default' ? selectedResumeName.label : selectedResumeName.originalFilename)
    : '';

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden px-4 backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: '#ffffff' }}>
        {/* Title bar */}
        <div className="flex items-center justify-between border-b-[3px] border-black bg-primary px-4 py-2">
          <div>
            <h2 className="font-mono text-sm font-bold uppercase">APPLY.EXE</h2>
            <p className="font-mono text-[10px] text-text-secondary truncate max-w-[220px]">{company} — {jobTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-5 w-5 shrink-0 items-center justify-center border-2 border-black bg-white font-mono text-xs font-bold hover:bg-background"
          >
            ×
          </button>
        </div>

        <div style={{ backgroundColor: '#ffffff' }} className="p-5">
          {result ? (
            /* ── Result screen ── */
            <div className="text-center space-y-4">
              <div>
                <p className="font-mono text-xs font-bold uppercase text-text-tertiary mb-1">Application tracked</p>
                <p className="font-mono text-sm font-bold text-text-primary">{displayName}</p>
              </div>

              {result.percentile !== null ? (
                <div className="flex flex-col items-center gap-1">
                  <p className="font-mono text-[10px] uppercase text-text-tertiary">You are in the</p>
                  <PercentileRing percentile={result.percentile} />
                  <p className="font-mono text-[10px] text-text-tertiary">
                    of {result.matchScore > 0 ? `applicants · match score ${result.matchScore}/100` : 'applicants'}
                  </p>
                </div>
              ) : result.earlyApplicantMessage ? (
                <div className="border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="font-mono text-xs font-bold text-emerald-700">🚀 Early applicant!</p>
                  <p className="font-mono text-[10px] text-emerald-600 mt-0.5">
                    You&apos;re one of the first to apply. Check back later for your percentile.
                  </p>
                </div>
              ) : (
                <div className="border border-black/10 bg-black/[0.02] px-4 py-3">
                  <p className="font-mono text-xs text-text-secondary">Application recorded. Upload a parsed resume to get your match score.</p>
                </div>
              )}

              {/* CTA — go to actual application */}
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Go Apply at {company} ↗
              </a>
              <button
                onClick={onClose}
                className="w-full border border-black/20 py-1.5 font-mono text-xs text-text-secondary hover:border-black/40"
              >
                Close
              </button>
            </div>
          ) : (
            /* ── Resume select screen ── */
            <>
              {loading ? (
                <p className="font-mono text-sm text-text-secondary animate-pulse py-4 text-center">Loading resumes...</p>
              ) : resumes.length === 0 ? (
                <div className="space-y-3 py-2">
                  <p className="font-mono text-sm font-bold text-text-secondary">No resumes in your vault</p>
                  <p className="font-mono text-xs text-text-tertiary">
                    Upload a resume to track your application and get a match score.
                  </p>
                  <a href="/vault" className="inline-block font-mono text-xs font-bold underline text-text-secondary hover:text-text-primary">
                    Go to Vault →
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase text-text-tertiary mb-2">Select resume to track with</p>
                    {!hasParsed && (
                      <div className="mb-3 border border-yellow-200 bg-yellow-50 px-3 py-2">
                        <p className="font-mono text-xs text-yellow-700">Resumes still parsing — check back shortly.</p>
                      </div>
                    )}
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {resumes.map((resume) => {
                        const isParsed = resume.status === 'PARSED';
                        const name = resume.label !== 'default' ? resume.label : resume.originalFilename;
                        return (
                          <label
                            key={resume.resumeId}
                            className={`flex cursor-pointer items-center gap-2.5 border-2 px-3 py-2 transition-all
                              ${!isParsed ? 'cursor-not-allowed opacity-40' : ''}
                              ${selectedResumeId === resume.resumeId && isParsed
                                ? 'border-black bg-primary/10'
                                : 'border-black/15 hover:border-black/30'
                              }`}
                          >
                            <input
                              type="radio"
                              name="resume"
                              value={resume.resumeId}
                              checked={selectedResumeId === resume.resumeId}
                              disabled={!isParsed}
                              onChange={() => isParsed && setSelectedResumeId(resume.resumeId)}
                              className="accent-black shrink-0"
                            />
                            <span className="font-mono text-xs font-bold text-text-primary truncate">{name}</span>
                            {!isParsed && (
                              <span className="ml-auto shrink-0 font-mono text-[9px] text-yellow-600">parsing…</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {error && <p className="font-mono text-xs font-bold text-red-600">⚠ {error}</p>}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !selectedResumeId || !hasParsed}
                    className="w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
                  >
                    {submitting ? 'Tracking...' : 'Track & Get Score'}
                  </button>
                  <p className="font-mono text-[10px] text-text-tertiary text-center">
                    We&apos;ll show your percentile rank, then take you to the real application.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
