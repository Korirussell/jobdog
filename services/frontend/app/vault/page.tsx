'use client';

import { useEffect, useState } from 'react';
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

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ALPHA_DOG:     { label: 'ALPHA DOG',     color: 'text-green-700',  bg: 'bg-green-50 border-green-300' },
  GOOD_BOY:      { label: 'GOOD BOY',      color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-300' },
  FETCH_PLAYER:  { label: 'FETCH PLAYER',  color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300' },
  HOUSE_TRAINED: { label: 'HOUSE TRAINED', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-300' },
  LOST_PUPPY:    { label: 'LOST PUPPY',    color: 'text-red-600',    bg: 'bg-red-50 border-red-300' },
  POUND_CANDIDATE:{ label: 'POUND CANDIDATE', color: 'text-red-800', bg: 'bg-red-100 border-red-400' },
};

export default function VaultPage() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [roastingId, setRoastingId] = useState<string | null>(null);
  const [roastResults, setRoastResults] = useState<Record<string, RoastResult>>({});
  const [roastErrors, setRoastErrors] = useState<Record<string, string>>({});
  const [activeRoast, setActiveRoast] = useState<string | null>(null);

  useEffect(() => {
    fetchResumes();
  }, []);

  async function fetchResumes() {
    try {
      const response = await api.getResumes();
      setResumes(response.items);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      await api.uploadResume(file);
      await fetchResumes();
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload resume. Check file size and format.');
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-uploaded
      e.target.value = '';
    }
  }

  async function handleRoast(resumeId: string) {
    if (roastingId) return;
    setRoastingId(resumeId);
    setRoastErrors((prev) => ({ ...prev, [resumeId]: '' }));
    try {
      const result = await api.roastResume(resumeId);
      setRoastResults((prev) => ({ ...prev, [resumeId]: result }));
      setActiveRoast(resumeId);
    } catch (err: any) {
      setRoastErrors((prev) => ({
        ...prev,
        [resumeId]: err?.message || 'Roast failed. Make sure your resume has been parsed.',
      }));
    } finally {
      setRoastingId(null);
    }
  }

  const statusIcon = (status: string) => {
    if (status === 'PARSED') return <span className="text-green-600">✓</span>;
    if (status === 'PROCESSING') return <span className="animate-spin inline-block">⟳</span>;
    return <span className="text-text-tertiary">◻</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <AuthGuard>
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

          {/* Page header */}
          <div className="mb-6">
            <h1 className="font-mono text-2xl font-bold text-text-primary">Resume Vault</h1>
            <p className="mt-1 font-mono text-sm text-text-secondary">
              {user?.displayName ? `${user.displayName}'s` : 'Your'} resumes · Upload PDFs, then roast them against the SWE intern bar
            </p>
          </div>

          {/* Upload zone */}
          <div className="mb-8 border-2 border-dashed border-black/20 bg-white p-6 transition-colors hover:border-primary/60 hover:bg-primary/5">
            <label className="flex cursor-pointer flex-col items-center gap-2">
              <input
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
              <div className="flex h-12 w-12 items-center justify-center border-2 border-black/10 bg-background font-mono text-2xl">
                {uploading ? <span className="animate-spin">⟳</span> : '📄'}
              </div>
              <p className="font-mono text-sm font-bold text-text-primary">
                {uploading ? 'Uploading...' : 'Click to upload PDF'}
              </p>
              <p className="font-mono text-xs text-text-tertiary">PDF only · 10 MB max</p>
            </label>
            {uploadError && (
              <p className="mt-3 text-center font-mono text-xs font-bold text-red-600">⚠ {uploadError}</p>
            )}
          </div>

          {/* Resume list */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-mono text-sm text-text-secondary">
                <span className="animate-pulse">█</span> Loading vault...
              </p>
            </div>
          ) : resumes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="font-mono text-lg font-bold text-text-secondary">Vault is empty</p>
              <p className="mt-2 font-mono text-sm text-text-tertiary">Upload a resume above to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {resumes.map((resume) => {
                const roast = roastResults[resume.resumeId];
                const roastError = roastErrors[resume.resumeId];
                const isRoasting = roastingId === resume.resumeId;
                const canRoast = resume.status === 'PARSED' && !isRoasting;
                const tier = roast ? TIER_CONFIG[roast.tierName] : null;

                return (
                  <div key={resume.resumeId} className="border-2 border-black/10 bg-white">
                    {/* Resume row */}
                    <div className="flex items-center justify-between gap-4 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black/10 bg-background font-mono text-xl">
                          {statusIcon(resume.status)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-bold text-text-primary">
                            {resume.label || resume.originalFilename}
                          </p>
                          <p className="font-mono text-xs text-text-tertiary">
                            {new Date(resume.uploadedAt).toLocaleDateString()} ·{' '}
                            <span className={resume.status === 'PARSED' ? 'text-green-600' : 'text-text-secondary'}>
                              {resume.status}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {roast && (
                          <button
                            onClick={() => setActiveRoast(activeRoast === resume.resumeId ? null : resume.resumeId)}
                            className="border-2 border-black/20 bg-white px-3 py-1.5 font-mono text-xs font-bold text-text-secondary transition-all hover:border-black hover:text-text-primary"
                          >
                            {activeRoast === resume.resumeId ? 'Hide' : 'View'} Roast
                          </button>
                        )}
                        <button
                          onClick={() => handleRoast(resume.resumeId)}
                          disabled={!canRoast}
                          title={
                            resume.status !== 'PARSED'
                              ? 'Resume must finish parsing before roasting'
                              : isRoasting
                              ? 'Roasting in progress...'
                              : 'Roast this resume'
                          }
                          className={`
                            border-2 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all
                            ${canRoast
                              ? 'border-black bg-primary text-text-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none'
                              : 'cursor-not-allowed border-black/20 bg-background text-text-tertiary'
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

                    {/* Roast error */}
                    {roastError && (
                      <div className="border-t-2 border-red-200 bg-red-50 px-4 py-3">
                        <p className="font-mono text-xs font-bold text-red-600">⚠ {roastError}</p>
                      </div>
                    )}

                    {/* Roast result panel */}
                    {roast && activeRoast === resume.resumeId && (
                      <div className={`border-t-2 border-black/10 p-4 ${tier?.bg ?? ''}`}>
                        {/* Score header */}
                        <div className="mb-4 flex items-center gap-4">
                          <div className="text-center">
                            <p className="font-mono text-3xl font-bold text-text-primary">{roast.topDogRank}</p>
                            <p className="font-mono text-xs text-text-tertiary">/ 100</p>
                          </div>
                          <div className="flex-1">
                            <p className={`font-mono text-sm font-bold ${tier?.color ?? 'text-text-primary'}`}>
                              {tier?.label ?? roast.tierName}
                            </p>
                            <div className="mt-1.5 h-2 w-full border border-black/20 bg-white">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${roast.topDogRank}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Roast text */}
                        <p className="mb-4 whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-primary">
                          {roast.brutalRoastText}
                        </p>

                        {/* Missing deps */}
                        {roast.missingDependencies.length > 0 && (
                          <div>
                            <p className="mb-2 font-mono text-xs font-bold uppercase text-red-600">
                              Missing dependencies:
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
