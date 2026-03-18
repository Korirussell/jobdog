'use client';

import { useEffect, useRef, useState } from 'react';
import TopBar from '@/components/TopBar';
import AuthGuard from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Resume {
  resumeId: string;
  label: string;
  originalFilename: string;
  status: string;
  uploadedAt: string;
}

interface RoastResult {
  brutalRoastText: string;
  missingDependencies: string[];
  topDogRank: number;
  tierName: string;
}

// Tier config — the grading system is intrinsic to the site
const TIERS = [
  {
    key: 'ALPHA_DOG',
    label: 'ALPHA DOG',
    range: [85, 100],
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    bar: 'bg-emerald-500',
    emoji: '🏆',
    desc: 'Top 5% of intern candidates. FAANG-ready.',
  },
  {
    key: 'GOOD_BOY',
    label: 'GOOD BOY',
    range: [70, 84],
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    bar: 'bg-blue-500',
    emoji: '🐕',
    desc: 'Strong candidate. A few gaps to close.',
  },
  {
    key: 'FETCH_PLAYER',
    label: 'FETCH PLAYER',
    range: [55, 69],
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    bar: 'bg-yellow-500',
    emoji: '🎾',
    desc: 'Decent baseline. Work on the missing deps.',
  },
  {
    key: 'HOUSE_TRAINED',
    label: 'HOUSE TRAINED',
    range: [40, 54],
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    bar: 'bg-orange-500',
    emoji: '🏠',
    desc: 'Needs more projects and skills.',
  },
  {
    key: 'LOST_PUPPY',
    label: 'LOST PUPPY',
    range: [20, 39],
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-300',
    bar: 'bg-red-500',
    emoji: '🐾',
    desc: 'Significant work needed before applying.',
  },
  {
    key: 'POUND_CANDIDATE',
    label: 'POUND CANDIDATE',
    range: [0, 19],
    color: 'text-red-800',
    bg: 'bg-red-100',
    border: 'border-red-400',
    bar: 'bg-red-700',
    emoji: '💀',
    desc: 'Start from scratch. Seriously.',
  },
];

function getTier(tierName: string) {
  return TIERS.find((t) => t.key === tierName) ?? TIERS[4];
}

// Animated score counter
function ScoreCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setDisplay(start);
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{display}</>;
}

export default function VaultPage() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [roastingId, setRoastingId] = useState<string | null>(null);
  const [roastResults, setRoastResults] = useState<Record<string, RoastResult>>({});
  const [roastErrors, setRoastErrors] = useState<Record<string, string>>({});
  const [expandedRoast, setExpandedRoast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchResumes();
  }, []);

  async function fetchResumes() {
    try {
      const response = await api.getResumes();
      setResumes(response.items);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function uploadAndRoast(file: File) {
    setUploadError('');
    setUploading(true);
    let newResumeId: string | null = null;
    try {
      const uploaded = await api.uploadResume(file);
      // uploadResume returns the new resume — grab its ID
      newResumeId = (uploaded as any)?.resumeId ?? null;
      await fetchResumes();
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Check file size (10 MB max) and format (PDF).');
      setUploading(false);
      return;
    }
    setUploading(false);

    // Auto-roast the newly uploaded resume after a brief delay for parsing
    if (newResumeId) {
      await roastResume(newResumeId);
    }
  }

  async function roastResume(resumeId: string) {
    if (roastingId) return;
    setRoastingId(resumeId);
    setRoastErrors((prev) => ({ ...prev, [resumeId]: '' }));
    try {
      const result = await api.roastResume(resumeId);
      setRoastResults((prev) => ({ ...prev, [resumeId]: result }));
      setExpandedRoast(resumeId);
    } catch (err: any) {
      setRoastErrors((prev) => ({
        ...prev,
        [resumeId]: err?.message || 'Roast failed. Resume may still be parsing — try again in a moment.',
      }));
    } finally {
      setRoastingId(null);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadAndRoast(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') uploadAndRoast(file);
    else setUploadError('Only PDF files are supported.');
  }

  const statusBadge = (status: string) => {
    if (status === 'PARSED') return (
      <span className="inline-flex items-center gap-1 bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        PARSED
      </span>
    );
    if (status === 'PROCESSING') return (
      <span className="inline-flex items-center gap-1 bg-yellow-100 px-2 py-0.5 font-mono text-[10px] font-bold text-yellow-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
        PROCESSING
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-bold text-gray-600">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <AuthGuard>
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

          {/* ── Page header ── */}
          <div className="mb-6">
            <h1 className="font-mono text-2xl font-bold text-text-primary">Resume Vault</h1>
            <p className="mt-1 font-mono text-sm text-text-secondary">
              {user?.displayName ? `${user.displayName}'s` : 'Your'} resumes ·{' '}
              Upload a PDF and get an instant AI roast scored against the SWE intern bar
            </p>
          </div>

          {/* ── Tier legend — grading system is intrinsic ── */}
          <div className="mb-6 border-2 border-black/10 bg-white p-4">
            <p className="mb-3 font-mono text-xs font-bold uppercase text-text-tertiary">Ranking System</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIERS.map((t) => (
                <div key={t.key} className={`flex items-center gap-2 border px-2 py-1.5 ${t.bg} ${t.border}`}>
                  <span className="text-sm">{t.emoji}</span>
                  <div>
                    <p className={`font-mono text-[10px] font-bold ${t.color}`}>{t.label}</p>
                    <p className="font-mono text-[9px] text-text-tertiary">{t.range[0]}–{t.range[1]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Upload zone ── */}
          <div
            className={`mb-8 border-2 border-dashed p-8 text-center transition-all ${
              dragOver
                ? 'border-primary bg-primary/10'
                : uploading
                ? 'border-black/20 bg-background'
                : 'cursor-pointer border-black/20 bg-white hover:border-primary/60 hover:bg-primary/5'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
            <div className="mb-3 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center border-2 border-black/10 bg-background text-3xl">
                {uploading ? <span className="animate-spin text-2xl">⟳</span> : '📄'}
              </div>
            </div>
            {uploading ? (
              <>
                <p className="font-mono text-sm font-bold text-text-primary">Uploading & parsing...</p>
                <p className="mt-1 font-mono text-xs text-text-tertiary">AI roast will begin automatically</p>
              </>
            ) : (
              <>
                <p className="font-mono text-sm font-bold text-text-primary">
                  Drop your resume here or click to upload
                </p>
                <p className="mt-1 font-mono text-xs text-text-tertiary">PDF only · 10 MB max · Auto-roasted on upload</p>
              </>
            )}
            {uploadError && (
              <p className="mt-3 font-mono text-xs font-bold text-red-600">⚠ {uploadError}</p>
            )}
          </div>

          {/* ── Resume list ── */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-mono text-sm text-text-secondary">
                <span className="animate-pulse">█</span> Loading vault...
              </p>
            </div>
          ) : resumes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 text-5xl">📭</div>
              <p className="font-mono text-lg font-bold text-text-secondary">Vault is empty</p>
              <p className="mt-2 font-mono text-sm text-text-tertiary">
                Upload a resume above — it&apos;ll be parsed and roasted automatically
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {resumes.map((resume) => {
                const roast = roastResults[resume.resumeId];
                const roastError = roastErrors[resume.resumeId];
                const isRoasting = roastingId === resume.resumeId;
                const isParsed = resume.status === 'PARSED';
                const tier = roast ? getTier(roast.tierName) : null;
                const isExpanded = expandedRoast === resume.resumeId;

                return (
                  <div key={resume.resumeId} className="border-2 border-black/10 bg-white">

                    {/* ── Resume row ── */}
                    <div className="flex items-center justify-between gap-4 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black/10 bg-background text-xl">
                          📄
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-bold text-text-primary">
                            {resume.label || resume.originalFilename}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="font-mono text-[10px] text-text-tertiary">
                              {new Date(resume.uploadedAt).toLocaleDateString()}
                            </span>
                            {statusBadge(resume.status)}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {/* Score badge if roasted */}
                        {roast && tier && (
                          <button
                            onClick={() => setExpandedRoast(isExpanded ? null : resume.resumeId)}
                            className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-xs font-bold transition-all hover:shadow-sm ${tier.bg} ${tier.border} ${tier.color}`}
                          >
                            <span>{tier.emoji}</span>
                            <span>{roast.topDogRank}/100</span>
                            <svg
                              className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}

                        {/* Roast button */}
                        <button
                          onClick={() => roastResume(resume.resumeId)}
                          disabled={isRoasting || !isParsed}
                          title={
                            !isParsed
                              ? 'Resume must finish parsing first'
                              : isRoasting
                              ? 'Roasting in progress...'
                              : roast
                              ? 'Re-roast this resume'
                              : 'Roast this resume'
                          }
                          className={`
                            border-2 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all
                            ${isRoasting
                              ? 'cursor-wait border-black/20 bg-background text-text-tertiary'
                              : !isParsed
                              ? 'cursor-default border-black/10 bg-background/50 text-text-tertiary opacity-50'
                              : 'cursor-pointer border-black bg-primary text-text-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none'
                            }
                          `}
                        >
                          {isRoasting ? (
                            <span className="flex items-center gap-1">
                              <span className="animate-spin">⟳</span> Roasting...
                            </span>
                          ) : roast ? '🔥 Re-roast' : '🔥 Roast'}
                        </button>
                      </div>
                    </div>

                    {/* ── Roast error ── */}
                    {roastError && (
                      <div className="border-t-2 border-red-200 bg-red-50 px-4 py-3">
                        <p className="font-mono text-xs font-bold text-red-600">⚠ {roastError}</p>
                      </div>
                    )}

                    {/* ── Roast result panel ── */}
                    {roast && isExpanded && tier && (
                      <div className={`border-t-2 border-black/10 p-5 ${tier.bg}`}>

                        {/* Score + tier header */}
                        <div className="mb-5 flex items-start gap-5">
                          {/* Big score */}
                          <div className="flex flex-col items-center">
                            <span className={`font-mono text-5xl font-bold leading-none ${tier.color}`}>
                              <ScoreCounter target={roast.topDogRank} />
                            </span>
                            <span className="font-mono text-xs text-text-tertiary">/ 100</span>
                          </div>

                          {/* Tier info + bar */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{tier.emoji}</span>
                              <p className={`font-mono text-base font-bold ${tier.color}`}>{tier.label}</p>
                            </div>
                            <p className="mt-0.5 font-mono text-xs text-text-secondary">{tier.desc}</p>
                            {/* Progress bar */}
                            <div className="mt-3 h-2 w-full border border-black/20 bg-white">
                              <div
                                className={`h-full transition-all duration-1000 ${tier.bar}`}
                                style={{ width: `${roast.topDogRank}%` }}
                              />
                            </div>
                            {/* Tier scale labels */}
                            <div className="mt-1 flex justify-between font-mono text-[9px] text-text-tertiary">
                              <span>0</span>
                              <span>25</span>
                              <span>50</span>
                              <span>75</span>
                              <span>100</span>
                            </div>
                          </div>
                        </div>

                        {/* Roast text */}
                        <div className={`mb-4 border ${tier.border} bg-white/80 p-4`}>
                          <p className="mb-1.5 font-mono text-[10px] font-bold uppercase text-text-tertiary">AI Verdict</p>
                          <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-primary">
                            {roast.brutalRoastText}
                          </p>
                        </div>

                        {/* Missing deps */}
                        {roast.missingDependencies.length > 0 && (
                          <div>
                            <p className="mb-2 font-mono text-xs font-bold uppercase text-red-600">
                              ⚠ Missing dependencies ({roast.missingDependencies.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {roast.missingDependencies.map((dep) => (
                                <span
                                  key={dep}
                                  className="border border-red-300 bg-white px-2 py-0.5 font-mono text-xs text-red-700"
                                >
                                  {dep}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </AuthGuard>
    </div>
  );
}
