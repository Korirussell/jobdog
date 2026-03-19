'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import TopBar from '@/components/TopBar';
import AuthGuard from '@/components/AuthGuard';
import { api, ResumeAnalysis, BulletFeedback, JobFitResult } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Resume {
  resumeId: string;
  label: string;
  originalFilename: string;
  status: string;
  uploadedAt: string;
}

interface Job {
  jobId: string;
  title: string;
  company: string;
}

// Score → tier mapping (matches backend rankToTier thresholds)
const TIERS = [
  { min: 90, label: 'ALPHA DOG', emoji: '🏆', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', bar: 'bg-emerald-500', desc: 'Top 5% of candidates. FAANG-ready.' },
  { min: 75, label: 'GOOD BOY', emoji: '🐕', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300', bar: 'bg-blue-500', desc: 'Strong candidate. Minor polish needed.' },
  { min: 60, label: 'FETCH PLAYER', emoji: '🦴', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', bar: 'bg-yellow-500', desc: 'Decent but clear gaps for top companies.' },
  { min: 40, label: 'HOUSE TRAINED', emoji: '🏠', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', bar: 'bg-orange-500', desc: 'Needs significant work.' },
  { min: 20, label: 'LOST PUPPY', emoji: '🐾', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300', bar: 'bg-red-400', desc: 'Major gaps. Start rebuilding.' },
  { min: 0, label: 'POUND CANDIDATE', emoji: '💀', color: 'text-red-800', bg: 'bg-red-100', border: 'border-red-400', bar: 'bg-red-600', desc: 'Complete overhaul needed.' },
];

function getTier(score: number) {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const tier = getTier(score);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let n = 0;
    const step = Math.ceil(score / 40);
    const t = setInterval(() => {
      n = Math.min(n + step, score);
      setDisplay(n);
      if (n >= score) clearInterval(t);
    }, 25);
    return () => clearInterval(t);
  }, [score]);

  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const dash = (display / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'}
          strokeWidth={6} strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.05s' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="font-mono text-xl font-bold text-text-primary">{display}</span>
        <span className="font-mono text-[9px] text-text-tertiary">/ 100</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { const t = setTimeout(() => setWidth(score), 100); return () => clearTimeout(t); }, [score]);
  const color = score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 font-mono text-xs text-text-secondary capitalize">{label.replace(/_/g, ' ')}</span>
      <div className="flex-1 h-2 bg-black/8 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-xs font-bold text-text-primary">{score}</span>
    </div>
  );
}

function BulletCard({ bullet, index }: { bullet: BulletFeedback; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = bullet.score >= 75 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : bullet.score >= 50 ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
    : 'text-red-700 bg-red-50 border-red-200';

  return (
    <div className="border border-black/8 bg-white">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
      >
        <span className={`mt-0.5 shrink-0 border px-1.5 py-0.5 font-mono text-[10px] font-bold ${scoreColor}`}>
          {bullet.score}
        </span>
        <span className="flex-1 font-mono text-xs text-text-secondary leading-relaxed line-clamp-2">
          {bullet.original || `Bullet ${index + 1}`}
        </span>
        <svg className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-black/8 px-4 py-3 space-y-3">
          {bullet.original && (
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-text-tertiary mb-1">Original</p>
              <p className="font-mono text-xs text-text-secondary leading-relaxed bg-black/[0.02] px-3 py-2 border-l-2 border-black/20">
                {bullet.original}
              </p>
            </div>
          )}
          {bullet.issue && (
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-red-600 mb-1">Issue</p>
              <p className="font-mono text-xs text-red-700 leading-relaxed">{bullet.issue}</p>
            </div>
          )}
          {bullet.improved && (
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-emerald-600 mb-1">Improved Version</p>
              <p className="font-mono text-xs text-emerald-800 leading-relaxed bg-emerald-50 px-3 py-2 border-l-2 border-emerald-400">
                {bullet.improved}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type AnalysisTab = 'overview' | 'bullets' | 'jobfit';

export default function VaultPage() {
  const { user } = useAuth();

  // Resume list
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis
  const [analysisCache, setAnalysisCache] = useState<Record<string, ResumeAnalysis>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');

  // Role targeting
  const [userLevel, setUserLevel] = useState<'INTERN' | 'NEW_GRAD'>('INTERN');
  const [targetRole, setTargetRole] = useState('Software Engineer');

  // Job fit
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobFitCache, setJobFitCache] = useState<Record<string, JobFitResult>>({});
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [jobFitLoading, setJobFitLoading] = useState(false);
  const [jobFitError, setJobFitError] = useState('');

  const selectedResume = resumes.find((r) => r.resumeId === selectedResumeId) ?? null;
  const currentAnalysis = selectedResumeId ? analysisCache[selectedResumeId] ?? null : null;
  const currentJobFitKey = selectedResumeId && selectedJobId ? `${selectedResumeId}:${selectedJobId}` : '';
  const currentJobFit = currentJobFitKey ? jobFitCache[currentJobFitKey] ?? null : null;

  // Load resumes on mount
  useEffect(() => {
    fetchResumes();
    fetchJobs();
  }, []);

  // Load cached analysis whenever selected resume changes
  useEffect(() => {
    if (!selectedResumeId || analysisCache[selectedResumeId]) return;
    api.getResumeAnalysis(selectedResumeId)
      .then((result) => {
        if (result) {
          setAnalysisCache((prev) => ({ ...prev, [selectedResumeId]: result }));
          setUserLevel((result.userLevel as 'INTERN' | 'NEW_GRAD') || 'INTERN');
          setTargetRole(result.targetRole || 'Software Engineer');
        }
      })
      .catch(() => {});
  }, [selectedResumeId]);

  async function fetchResumes() {
    try {
      const res = await api.getResumes();
      setResumes(res.items);
      if (res.items.length > 0 && !selectedResumeId) {
        setSelectedResumeId(res.items[0].resumeId);
      }
    } catch {
      // silently fail
    } finally {
      setResumesLoading(false);
    }
  }

  async function fetchJobs() {
    try {
      const res = await fetch('/api/v1/jobs?page=0&size=50');
      if (res.ok) {
        const data = await res.json();
        setJobs((data.items ?? []).map((j: any) => ({ jobId: j.jobId, title: j.title, company: j.company })));
      }
    } catch {}
  }

  async function uploadAndAnalyze(file: File) {
    setUploadError('');
    setUploading(true);
    try {
      const uploaded = await api.uploadResume(file);
      const newId = (uploaded as any)?.resumeId ?? null;
      await fetchResumes();
      if (newId) setSelectedResumeId(newId);
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Check file size (10 MB max) and format (PDF).');
    } finally {
      setUploading(false);
    }
  }

  async function runAnalysis() {
    if (!selectedResumeId) return;
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const result = await api.analyzeResume(selectedResumeId, userLevel, targetRole);
      setAnalysisCache((prev) => ({ ...prev, [selectedResumeId]: result }));
      setActiveTab('overview');
    } catch (err: any) {
      setAnalyzeError(err?.message || 'Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function runJobFit() {
    if (!selectedResumeId || !selectedJobId) return;
    setJobFitLoading(true);
    setJobFitError('');
    try {
      const result = await api.getJobFitAnalysis(selectedResumeId, selectedJobId);
      setJobFitCache((prev) => ({ ...prev, [`${selectedResumeId}:${selectedJobId}`]: result }));
    } catch (err: any) {
      setJobFitError(err?.message || 'Job fit analysis failed. Please try again.');
    } finally {
      setJobFitLoading(false);
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadAndAnalyze(file);
  }, []);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      UPLOADED: 'bg-blue-50 text-blue-700 border-blue-200',
      PROCESSING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      PARSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      FAILED: 'bg-red-50 text-red-700 border-red-200',
    };
    return map[status] ?? 'bg-black/5 text-text-secondary border-black/10';
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <TopBar />

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="font-mono text-2xl font-bold text-text-primary">Resume Vault</h1>
            <p className="mt-1 font-mono text-sm text-text-secondary">
              FAANG-grade analysis · Section scoring · ATS check · Job fit
            </p>
          </div>

          <div className="flex gap-6 lg:flex-row flex-col">
            {/* ── Left column: resume list + upload ── */}
            <div className="w-full lg:w-72 shrink-0 space-y-4">
              {/* Upload zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  cursor-pointer border-2 border-dashed px-4 py-6 text-center transition-colors
                  ${dragOver ? 'border-primary bg-primary/10' : 'border-black/20 hover:border-black/40 hover:bg-black/[0.02]'}
                  ${uploading ? 'pointer-events-none opacity-60' : ''}
                `}
              >
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAndAnalyze(f); e.target.value = ''; }} />
                <div className="text-2xl mb-2">{uploading ? '⏳' : '📄'}</div>
                <p className="font-mono text-xs font-bold text-text-primary">
                  {uploading ? 'Uploading...' : 'Drop PDF or click to upload'}
                </p>
                <p className="font-mono text-[10px] text-text-tertiary mt-1">PDF only · 10 MB max</p>
              </div>
              {uploadError && (
                <p className="font-mono text-xs font-bold text-red-600">⚠ {uploadError}</p>
              )}

              {/* Resume list */}
              <div className="space-y-1">
                <p className="font-mono text-[10px] font-bold uppercase text-text-tertiary px-1">Your Resumes</p>
                {resumesLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => <div key={i} className="h-14 animate-pulse bg-black/5 border border-black/8" />)}
                  </div>
                ) : resumes.length === 0 ? (
                  <div className="border border-black/8 px-4 py-6 text-center">
                    <p className="font-mono text-xs text-text-tertiary">No resumes yet.</p>
                    <p className="font-mono text-[10px] text-text-tertiary mt-1">Upload a PDF to get started.</p>
                  </div>
                ) : (
                  resumes.map((r) => {
                    const isSelected = r.resumeId === selectedResumeId;
                    const hasAnalysis = !!analysisCache[r.resumeId];
                    return (
                      <button
                        key={r.resumeId}
                        onClick={() => setSelectedResumeId(r.resumeId)}
                        className={`
                          w-full text-left border-2 px-3 py-2.5 transition-all
                          ${isSelected ? 'border-black bg-black/[0.03]' : 'border-black/15 hover:border-black/30'}
                        `}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-bold text-text-primary truncate">
                              {r.label !== 'default' ? r.label : r.originalFilename}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={`border px-1.5 py-0.5 font-mono text-[9px] font-bold ${statusBadge(r.status)}`}>
                                {r.status}
                              </span>
                              {hasAnalysis && (
                                <span className="font-mono text-[9px] text-emerald-600 font-bold">● analyzed</span>
                              )}
                            </div>
                          </div>
                          {hasAnalysis && (
                            <span className="shrink-0 font-mono text-sm font-bold text-text-primary">
                              {analysisCache[r.resumeId].overallScore}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Right column: analysis panel ── */}
            <div className="flex-1 min-w-0">
              {!selectedResume ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-black/8">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="font-mono text-sm font-bold text-text-secondary">Select or upload a resume</p>
                  <p className="font-mono text-xs text-text-tertiary mt-1">Your analysis will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Resume header + role targeting */}
                  <div className="border-2 border-black/10 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="font-mono text-sm font-bold text-text-primary">
                          {selectedResume.label !== 'default' ? selectedResume.label : selectedResume.originalFilename}
                        </h2>
                        <span className={`mt-1 inline-block border px-1.5 py-0.5 font-mono text-[9px] font-bold ${statusBadge(selectedResume.status)}`}>
                          {selectedResume.status}
                        </span>
                      </div>

                      {/* Role targeting controls */}
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="block font-mono text-[10px] font-bold uppercase text-text-tertiary mb-1">I am a</label>
                          <select
                            value={userLevel}
                            onChange={(e) => setUserLevel(e.target.value as 'INTERN' | 'NEW_GRAD')}
                            className="border-2 border-black/20 bg-white px-2 py-1.5 font-mono text-xs font-bold text-text-primary focus:border-black focus:outline-none"
                          >
                            <option value="INTERN">Intern candidate</option>
                            <option value="NEW_GRAD">New grad candidate</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-mono text-[10px] font-bold uppercase text-text-tertiary mb-1">Targeting role</label>
                          <input
                            type="text"
                            value={targetRole}
                            onChange={(e) => setTargetRole(e.target.value)}
                            placeholder="e.g. Software Engineer"
                            className="border-2 border-black/20 bg-white px-2 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-black focus:outline-none w-44"
                          />
                        </div>
                        <button
                          onClick={runAnalysis}
                          disabled={analyzing || selectedResume.status !== 'PARSED'}
                          title={selectedResume.status !== 'PARSED' ? 'Resume must finish parsing before analysis' : ''}
                          className="border-2 border-black bg-primary px-4 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
                        >
                          {analyzing ? '⏳ Analyzing...' : currentAnalysis ? '↻ Re-analyze' : '▶ Analyze'}
                        </button>
                      </div>
                    </div>
                    {analyzeError && (
                      <p className="mt-3 font-mono text-xs font-bold text-red-600">⚠ {analyzeError}</p>
                    )}
                    {selectedResume.status === 'PROCESSING' && (
                      <p className="mt-3 font-mono text-xs text-yellow-700">
                        <span className="animate-pulse">⏳</span> Resume is still being parsed — analysis will be available shortly.
                      </p>
                    )}
                    {selectedResume.status === 'UPLOADED' && (
                      <p className="mt-3 font-mono text-xs text-blue-700">
                        Resume uploaded — parsing in progress...
                      </p>
                    )}
                  </div>

                  {/* Analysis content */}
                  {analyzing ? (
                    <div className="border border-black/8 bg-white p-8 text-center">
                      <div className="text-3xl mb-3 animate-pulse">🔍</div>
                      <p className="font-mono text-sm font-bold text-text-primary">Analyzing your resume...</p>
                      <p className="font-mono text-xs text-text-tertiary mt-1">
                        Running FAANG-grade analysis for {userLevel === 'INTERN' ? 'internship' : 'new grad'} {targetRole} roles
                      </p>
                    </div>
                  ) : currentAnalysis ? (
                    <>
                      {/* Tabs */}
                      <div className="flex border-b-2 border-black/10">
                        {(['overview', 'bullets', 'jobfit'] as AnalysisTab[]).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2.5 font-mono text-xs font-bold capitalize transition-colors border-b-2 -mb-0.5
                              ${activeTab === tab
                                ? 'border-b-black text-text-primary'
                                : 'border-b-transparent text-text-secondary hover:text-text-primary'
                              }`}
                          >
                            {tab === 'overview' ? 'Overview' : tab === 'bullets' ? `Bullets (${currentAnalysis.bulletFeedback.length})` : 'Job Fit'}
                          </button>
                        ))}
                      </div>

                      {/* Overview tab */}
                      {activeTab === 'overview' && (
                        <div className="space-y-4">
                          {/* Score + tier + verdict */}
                          <div className="border border-black/8 bg-white p-5">
                            <div className="flex flex-wrap items-center gap-6">
                              <ScoreRing score={currentAnalysis.overallScore} size={96} />
                              <div className="flex-1 min-w-0">
                                {(() => {
                                  const tier = getTier(currentAnalysis.overallScore);
                                  return (
                                    <div className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-xs font-bold mb-2 ${tier.bg} ${tier.border} ${tier.color}`}>
                                      <span>{tier.emoji}</span>
                                      <span>{tier.label}</span>
                                    </div>
                                  );
                                })()}
                                <p className="font-mono text-xs text-text-secondary leading-relaxed">
                                  {currentAnalysis.summaryVerdict}
                                </p>
                                <p className="mt-2 font-mono text-[10px] text-text-tertiary">
                                  Analyzed for: <span className="font-bold text-text-secondary">{currentAnalysis.userLevel === 'INTERN' ? 'Internship' : 'New Grad'} · {currentAnalysis.targetRole}</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* ATS score */}
                          <div className="border border-black/8 bg-white p-5">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-mono text-xs font-bold uppercase text-text-secondary">ATS Readability</h3>
                              <span className={`font-mono text-lg font-bold ${currentAnalysis.atsScore >= 70 ? 'text-emerald-600' : currentAnalysis.atsScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {currentAnalysis.atsScore}<span className="text-xs text-text-tertiary">/100</span>
                              </span>
                            </div>
                            <div className="h-2 bg-black/8 rounded-full overflow-hidden mb-3">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${currentAnalysis.atsScore >= 70 ? 'bg-emerald-500' : currentAnalysis.atsScore >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                style={{ width: `${currentAnalysis.atsScore}%` }}
                              />
                            </div>
                            {currentAnalysis.atsIssues.length > 0 ? (
                              <ul className="space-y-1.5">
                                {currentAnalysis.atsIssues.map((issue, i) => (
                                  <li key={i} className="flex items-start gap-2 font-mono text-xs text-text-secondary">
                                    <span className="mt-0.5 shrink-0 text-red-500">✗</span>
                                    {issue}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="font-mono text-xs text-emerald-600">✓ No major ATS issues detected</p>
                            )}
                          </div>

                          {/* Section scores */}
                          {Object.keys(currentAnalysis.sectionScores).length > 0 && (
                            <div className="border border-black/8 bg-white p-5">
                              <h3 className="font-mono text-xs font-bold uppercase text-text-secondary mb-4">Section Scores</h3>
                              <div className="space-y-3">
                                {Object.entries(currentAnalysis.sectionScores).map(([key, score]) => (
                                  <ScoreBar key={key} label={key} score={score} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Strengths + improvements */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {currentAnalysis.strengths.length > 0 && (
                              <div className="border border-emerald-200 bg-emerald-50 p-4">
                                <h3 className="font-mono text-[10px] font-bold uppercase text-emerald-700 mb-3">Strengths</h3>
                                <ul className="space-y-2">
                                  {currentAnalysis.strengths.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2 font-mono text-xs text-emerald-800">
                                      <span className="shrink-0 text-emerald-500">✓</span>
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {currentAnalysis.improvements.length > 0 && (
                              <div className="border border-orange-200 bg-orange-50 p-4">
                                <h3 className="font-mono text-[10px] font-bold uppercase text-orange-700 mb-3">Areas to Improve</h3>
                                <ul className="space-y-2">
                                  {currentAnalysis.improvements.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2 font-mono text-xs text-orange-800">
                                      <span className="shrink-0 text-orange-500">→</span>
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bullets tab */}
                      {activeTab === 'bullets' && (
                        <div className="border border-black/8 bg-white">
                          <div className="border-b border-black/8 px-4 py-3">
                            <p className="font-mono text-xs text-text-secondary">
                              Each bullet point graded 0–100. Click to see what's wrong and an improved version.
                            </p>
                          </div>
                          {currentAnalysis.bulletFeedback.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                              <p className="font-mono text-xs text-text-tertiary">No bullet points detected in this resume.</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-black/5">
                              {currentAnalysis.bulletFeedback.map((b, i) => (
                                <BulletCard key={i} bullet={b} index={i} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Job Fit tab */}
                      {activeTab === 'jobfit' && (
                        <div className="space-y-4">
                          <div className="border border-black/8 bg-white p-5">
                            <h3 className="font-mono text-xs font-bold uppercase text-text-secondary mb-3">
                              Match Against a Real Job
                            </h3>
                            <p className="font-mono text-xs text-text-tertiary mb-4">
                              Select a job from our listings to get a fit score and gap analysis specific to that role.
                            </p>
                            <div className="flex flex-wrap gap-3">
                              <select
                                value={selectedJobId}
                                onChange={(e) => setSelectedJobId(e.target.value)}
                                className="flex-1 min-w-0 border-2 border-black/20 bg-white px-2 py-1.5 font-mono text-xs text-text-primary focus:border-black focus:outline-none"
                              >
                                <option value="">— Select a job —</option>
                                {jobs.map((j) => (
                                  <option key={j.jobId} value={j.jobId}>
                                    {j.title} @ {j.company}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={runJobFit}
                                disabled={!selectedJobId || jobFitLoading}
                                className="border-2 border-black bg-primary px-4 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
                              >
                                {jobFitLoading ? '⏳ Scoring...' : currentJobFit ? '↻ Re-score' : '▶ Score Fit'}
                              </button>
                            </div>
                            {jobFitError && (
                              <p className="mt-3 font-mono text-xs font-bold text-red-600">⚠ {jobFitError}</p>
                            )}
                          </div>

                          {jobFitLoading && (
                            <div className="border border-black/8 bg-white p-8 text-center">
                              <div className="text-3xl mb-3 animate-pulse">🎯</div>
                              <p className="font-mono text-sm font-bold text-text-primary">Scoring job fit...</p>
                            </div>
                          )}

                          {currentJobFit && !jobFitLoading && (
                            <div className="space-y-4">
                              <div className="border border-black/8 bg-white p-5">
                                <div className="flex items-center gap-5 mb-4">
                                  <ScoreRing score={currentJobFit.fitScore} size={80} />
                                  <div>
                                    <p className="font-mono text-xs font-bold uppercase text-text-tertiary">Fit Score</p>
                                    <p className="font-mono text-sm font-bold text-text-primary mt-0.5">
                                      {currentJobFit.jobTitle} @ {currentJobFit.company}
                                    </p>
                                    <p className="font-mono text-xs text-text-secondary mt-2 leading-relaxed max-w-lg">
                                      {currentJobFit.fitSummary}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {currentJobFit.matchedSkills.length > 0 && (
                                  <div className="border border-emerald-200 bg-emerald-50 p-4">
                                    <h4 className="font-mono text-[10px] font-bold uppercase text-emerald-700 mb-3">Matched Skills</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                      {currentJobFit.matchedSkills.map((s, i) => (
                                        <span key={i} className="border border-emerald-300 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                                          ✓ {s}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {currentJobFit.missingSkills.length > 0 && (
                                  <div className="border border-red-200 bg-red-50 p-4">
                                    <h4 className="font-mono text-[10px] font-bold uppercase text-red-700 mb-3">Missing Skills</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                      {currentJobFit.missingSkills.map((s, i) => (
                                        <span key={i} className="border border-red-300 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-red-700">
                                          ✗ {s}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    /* No analysis yet */
                    <div className="border border-black/8 bg-white p-8 text-center">
                      <div className="text-4xl mb-3">🔬</div>
                      <p className="font-mono text-sm font-bold text-text-primary">No analysis yet</p>
                      <p className="font-mono text-xs text-text-tertiary mt-1 max-w-sm mx-auto">
                        Set your target level and role above, then click Analyze to get a FAANG-grade breakdown of your resume.
                      </p>
                      {selectedResume.status !== 'PARSED' && (
                        <p className="mt-3 font-mono text-xs text-yellow-700">
                          Waiting for resume to finish parsing before analysis is available.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
