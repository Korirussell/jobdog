'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import BattleResults from '@/components/BattleResults';
import { api } from '@/lib/api';
import type { BattleState } from '@/lib/api';

export default function BattleAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [battle, setBattle] = useState<BattleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getBattle(token)
      .then(setBattle)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!file) { setError('Upload your resume to accept the challenge.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.submitBattleChallenge(token, file, name);
      setBattle(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit your resume.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {loading ? (
          <p className="text-center font-mono text-sm text-text-secondary animate-pulse">Loading battle...</p>
        ) : notFound ? (
          <div className="border-2 border-black bg-white p-6 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="font-mono text-sm font-bold text-text-primary">This battle link doesn&apos;t exist.</p>
            <p className="mt-1 font-mono text-xs text-text-tertiary">It may have expired, or the link was mistyped.</p>
          </div>
        ) : battle?.status === 'COMPLETE' ? (
          <div className="space-y-4">
            <h1 className="text-center font-mono text-xl font-bold text-text-primary">⚔ Battle complete</h1>
            <BattleResults battle={battle} />
            <p className="text-center font-mono text-xs text-text-tertiary">
              Want to run your own battle? <a href="/battle" className="font-bold underline hover:text-text-primary">Start one →</a>
            </p>
          </div>
        ) : battle ? (
          <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h1 className="mb-1 font-mono text-xl font-bold text-text-primary">⚔ You&apos;ve been challenged</h1>
            <p className="mb-5 font-mono text-sm text-text-secondary">
              <span className="font-bold text-text-primary">{battle.creatorLabel}</span> sent you a resume battle. Upload yours to see who wins — and where.
            </p>

            <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase text-text-tertiary">Your name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={120}
              className="mb-4 w-full border-2 border-black/15 bg-white px-3 py-2 font-mono text-sm text-text-primary placeholder-text-tertiary focus:border-black/40 focus:outline-none"
            />

            <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase text-text-tertiary">Your resume (PDF)</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) setFile(dropped);
              }}
              className="mb-4 flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-black/20 bg-background px-4 py-8 text-center transition-colors hover:border-black/40"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <p className="font-mono text-sm font-bold text-text-primary">{file.name}</p>
              ) : (
                <>
                  <p className="font-mono text-sm font-bold text-text-secondary">Drop your resume here, or click to browse</p>
                  <p className="mt-1 font-mono text-[10px] text-text-tertiary">PDF only</p>
                </>
              )}
            </div>

            {error && <p className="mb-3 font-mono text-xs font-bold text-red-600">⚠ {error}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || !file}
              className="w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
            >
              {submitting ? 'Scoring your resume...' : 'Accept the challenge'}
            </button>
            <p className="mt-3 text-center font-mono text-[10px] text-text-tertiary">
              No account needed. Your resume is scored once and not saved.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
