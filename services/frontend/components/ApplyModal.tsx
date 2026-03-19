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
  onClose: () => void;
  onSuccess: (jobId: string) => void;
}

export default function ApplyModal({ jobId, jobTitle, company, onClose, onSuccess }: ApplyModalProps) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ matchScore: number; benchmarkState: string } | null>(null);

  useEffect(() => {
    api.getResumes()
      .then((res) => {
        // Show ALL resumes, not just parsed — but only allow selecting PARSED ones
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
      setResult({ matchScore: res.matchScore, benchmarkState: res.benchmarkState });
      onSuccess(jobId);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasParsed = resumes.some((r) => r.status === 'PARSED');

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PARSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      PROCESSING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      UPLOADED: 'bg-blue-50 text-blue-700 border-blue-200',
      FAILED: 'bg-red-50 text-red-700 border-red-200',
    };
    return map[status] ?? 'bg-black/5 text-text-secondary border-black/10';
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden px-4 backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: '#ffffff' }}>
        {/* Title Bar */}
        <div className="flex items-center justify-between border-b-[3px] border-black bg-primary px-4 py-2">
          <h2 className="font-mono text-sm font-bold uppercase">APPLY.EXE</h2>
          <button
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center border-2 border-black bg-white font-mono text-xs font-bold hover:bg-background"
          >
            ×
          </button>
        </div>

        <div className="bg-white p-6">
          {result ? (
            <div className="text-center">
              <p className="mb-2 font-mono text-2xl font-bold text-emerald-600">✓ APPLIED</p>
              <p className="font-mono text-sm text-text-secondary">{company} — {jobTitle}</p>
              {result.matchScore > 0 && (
                <div className="mt-4 border-2 border-black/10 bg-gray-50 p-4">
                  <p className="font-mono text-xs font-bold uppercase text-text-secondary">MATCH SCORE</p>
                  <p className="font-mono text-3xl font-bold text-text-primary">
                    {result.matchScore}<span className="text-lg text-text-secondary">/100</span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-text-tertiary uppercase">
                    {result.benchmarkState?.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-6 border-2 border-black bg-primary px-6 py-2 font-mono text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                CLOSE
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="font-mono text-xs text-text-secondary uppercase">Applying to</p>
                <p className="font-mono text-base font-bold text-text-primary">{company}</p>
                <p className="font-mono text-sm text-text-secondary">{jobTitle}</p>
              </div>

              {loading ? (
                <p className="font-mono text-sm text-text-secondary">
                  <span className="animate-pulse">|</span> Loading resumes...
                </p>
              ) : resumes.length === 0 ? (
                <div className="border-2 border-black/10 bg-gray-50 p-4">
                  <p className="font-mono text-sm font-bold text-text-secondary">No resumes found</p>
                  <p className="mt-1 font-mono text-xs text-text-secondary">
                    Upload a resume in the Vault before applying.
                  </p>
                  <a href="/vault" className="mt-3 inline-block font-mono text-xs font-bold text-primary underline hover:no-underline">
                    Go to Vault →
                  </a>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="mb-2 block font-mono text-xs font-bold uppercase text-text-secondary">
                      Select Resume
                    </label>
                    {!hasParsed && (
                      <div className="mb-3 border border-yellow-200 bg-yellow-50 px-3 py-2">
                        <p className="font-mono text-xs text-yellow-700">
                          Your resumes are still processing. You can apply once parsing is complete.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {resumes.map((resume) => {
                        const isParsed = resume.status === 'PARSED';
                        return (
                          <label
                            key={resume.resumeId}
                            className={`flex cursor-pointer items-center gap-3 border-2 p-3 transition-all
                              ${!isParsed ? 'cursor-not-allowed opacity-50' : ''}
                              ${selectedResumeId === resume.resumeId && isParsed
                                ? 'border-black bg-primary/10'
                                : 'border-black/20 bg-white hover:border-black/40'
                              }`}
                          >
                            <input
                              type="radio"
                              name="resume"
                              value={resume.resumeId}
                              checked={selectedResumeId === resume.resumeId}
                              disabled={!isParsed}
                              onChange={() => isParsed && setSelectedResumeId(resume.resumeId)}
                              className="accent-black"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm font-bold text-text-primary truncate">
                                {resume.label !== 'default' ? resume.label : resume.originalFilename}
                              </p>
                              <span className={`mt-0.5 inline-block border px-1.5 py-0.5 font-mono text-[9px] font-bold ${statusBadge(resume.status)}`}>
                                {resume.status === 'PROCESSING' ? 'Still parsing...' : resume.status}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {error && (
                    <p className="mb-3 font-mono text-xs font-bold text-red-600">⚠ {error}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !selectedResumeId || !hasParsed}
                      className="flex-1 border-2 border-black bg-primary px-4 py-2 font-mono text-sm font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
                    >
                      {submitting ? 'Submitting...' : '> Submit Application'}
                    </button>
                    <button
                      onClick={onClose}
                      className="border-2 border-black/20 bg-white px-4 py-2 font-mono text-sm font-bold uppercase text-text-secondary hover:border-black hover:text-text-primary"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
