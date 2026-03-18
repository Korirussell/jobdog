'use client';

import { useEffect, useState } from 'react';
import MorphingHeader from '@/components/MorphingHeader';
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

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  ALPHA_DOG: { label: 'ALPHA DOG', color: 'text-success' },
  GOOD_BOY: { label: 'GOOD BOY', color: 'text-info' },
  FETCH_PLAYER: { label: 'FETCH PLAYER', color: 'text-primary-dark' },
  HOUSE_TRAINED: { label: 'HOUSE TRAINED', color: 'text-text-secondary' },
  LOST_PUPPY: { label: 'LOST PUPPY', color: 'text-secondary' },
  POUND_CANDIDATE: { label: 'POUND CANDIDATE', color: 'text-danger' },
};

export default function VaultPage() {
  const { isAuthenticated, user } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [roastResult, setRoastResult] = useState<RoastResult | null>(null);
  const [roasting, setRoasting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetchResumes();
  }, [isAuthenticated]);

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

    setUploading(true);
    try {
      await api.uploadResume(file);
      await fetchResumes();
    } catch {
      alert('Failed to upload resume');
    } finally {
      setUploading(false);
    }
  }

  return (
    <AuthGuard>
    <div className="min-h-screen">
      <MorphingHeader />
      
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-8">
        {/* Window Frame: The Vault */}
        <div className="border-[3px] border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          {/* Title Bar */}
          <div className="flex items-center justify-between border-b-[3px] border-black bg-primary px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 border-2 border-black bg-white" />
              <h1 className="font-mono text-sm font-bold uppercase tracking-wide">
                THE_VAULT.EXE — {user?.displayName || 'ANONYMOUS'}
              </h1>
            </div>
            <div className="flex gap-2">
              <div className="flex h-5 w-5 items-center justify-center border-2 border-black bg-white font-mono text-xs font-bold">_</div>
              <div className="flex h-5 w-5 items-center justify-center border-2 border-black bg-white font-mono text-xs font-bold">□</div>
            </div>
          </div>

          <div className="p-6">
              <div className="space-y-6">
                {/* Upload Section */}
                <div className="border-2 border-black/10 bg-background p-4">
                  <h2 className="mb-3 font-mono text-sm font-bold uppercase text-text-primary">
                    &gt; UPLOAD_RESUME.EXE
                  </h2>
                  <label className="flex cursor-pointer items-center justify-center border-2 border-dashed border-black/20 bg-white p-6 transition-all hover:border-primary hover:bg-primary/5">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <div className="text-center">
                      <p className="font-mono text-sm font-bold text-text-primary">
                        {uploading ? 'UPLOADING...' : 'DROP_FILE_HERE.PDF'}
                      </p>
                      <p className="mt-1 font-mono text-xs text-text-tertiary">
                        PDF only - 10MB max
                      </p>
                    </div>
                  </label>
                </div>

                {/* Resume List */}
                <div>
                  <div className="border-b-2 border-black/10 py-2">
                    <p className="font-mono text-xs font-bold uppercase text-text-secondary">
                      VAULT CONTENTS: <span className="text-text-primary">{resumes.length}</span> FILE(S)
                    </p>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="font-mono text-sm text-text-secondary">
                        <span className="animate-pulse">|</span> SCANNING_VAULT.EXE
                      </div>
                    </div>
                  ) : resumes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <p className="font-mono text-sm text-text-secondary">VAULT_EMPTY.LOG</p>
                      <p className="mt-2 text-sm text-text-tertiary">Upload a resume to unlock the roaster</p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {resumes.map((resume) => (
                        <div
                          key={resume.resumeId}
                          className="flex items-center justify-between border-2 border-black/10 bg-white p-4 transition-all hover:border-black/20"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center border-2 border-black/10 bg-background font-mono text-lg">
                              {resume.status === 'PARSED' ? '✓' : resume.status === 'PROCESSING' ? '⟳' : '◻'}
                            </div>
                            <div>
                              <h3 className="font-mono text-sm font-bold text-text-primary">
                                {resume.label || resume.originalFilename}
                              </h3>
                              <p className="font-mono text-xs text-text-tertiary">
                                {new Date(resume.uploadedAt).toLocaleDateString()} — {resume.status}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top Dog Roast Result */}
                {roastResult && (
                  <div className="border-[3px] border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="border-b-[3px] border-black bg-secondary px-4 py-2">
                      <h2 className="font-mono text-sm font-bold uppercase text-white">
                        TOP_DOG_ROAST.EXE — RANK: {roastResult.topDogRank}/100
                      </h2>
                    </div>
                    <div className="p-4">
                      <div className="mb-3 flex items-center gap-3">
                        <span className={`font-mono text-lg font-bold ${TIER_LABELS[roastResult.tierName]?.color || 'text-text-primary'}`}>
                          {TIER_LABELS[roastResult.tierName]?.label || roastResult.tierName}
                        </span>
                        <div className="h-4 flex-1 border-2 border-black/20 bg-background">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${roastResult.topDogRank}%` }}
                          />
                        </div>
                      </div>
                      <p className="mb-3 whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-primary">
                        {roastResult.brutalRoastText}
                      </p>
                      {roastResult.missingDependencies.length > 0 && (
                        <div className="border-t-2 border-black/10 pt-3">
                          <p className="mb-2 font-mono text-xs font-bold uppercase text-danger">
                            MISSING DEPENDENCIES:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {roastResult.missingDependencies.map((dep) => (
                              <span key={dep} className="border-2 border-danger/30 bg-danger/10 px-2 py-0.5 font-mono text-xs text-danger">
                                {dep}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}
