'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import TopBar from '@/components/TopBar';
import BattleResults, { BattleResultCard } from '@/components/BattleResults';
import { api } from '@/lib/api';
import type { BattleState } from '@/lib/api';

interface ResumeOption {
  resumeId: string;
  label: string;
  originalFilename: string;
  status: string;
}

function shareUrlFor(token: string) {
  return `${window.location.origin}/battle/${token}`;
}

export default function BattlePage() {
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    api.getResumes().then((res) => {
      setResumes(res.items);
      const firstParsed = res.items.find((r) => r.status === 'PARSED');
      if (firstParsed) setSelectedResumeId(firstParsed.resumeId);
    });
  }, []);

  // Once a link exists, poll for the challenger's result rather than making
  // the creator manually refresh to see who won.
  useEffect(() => {
    if (!battle || battle.status === 'COMPLETE') return;
    setPolling(true);
    const interval = setInterval(() => {
      api.getBattle(battle.token)
        .then((updated) => {
          setBattle(updated);
          if (updated.status === 'COMPLETE') setPolling(false);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [battle?.token, battle?.status]);

  const handleCreate = async () => {
    if (!selectedResumeId) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.createBattle(selectedResumeId);
      setBattle(created);
    } catch (err: any) {
      setError(err?.message || 'Failed to start a battle.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!battle) return;
    try {
      await navigator.clipboard.writeText(shareUrlFor(battle.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const hasParsed = resumes.some((r) => r.status === 'PARSED');

  return (
    <AuthGuard>
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="font-mono text-2xl font-bold text-text-primary">⚔ Resume Battle</h1>
          <p className="mt-1 font-mono text-sm text-text-secondary">
            Pick a resume, get a link, send it to a friend. Whoever&apos;s resume scores higher wins — and you&apos;ll see exactly where each of you pulled ahead.
          </p>
        </div>

        {!battle ? (
          <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {resumes.length === 0 ? (
              <div className="space-y-3 py-2 text-center">
                <p className="font-mono text-sm font-bold text-text-secondary">No resumes in your vault</p>
                <a href="/vault" className="inline-block font-mono text-xs font-bold underline text-text-secondary hover:text-text-primary">
                  Go to Vault →
                </a>
              </div>
            ) : (
              <>
                <p className="mb-2 font-mono text-[10px] font-bold uppercase text-text-tertiary">Which resume is fighting?</p>
                {!hasParsed && (
                  <div className="mb-3 border border-yellow-200 bg-yellow-50 px-3 py-2">
                    <p className="font-mono text-xs text-yellow-700">Resumes still parsing — check back shortly.</p>
                  </div>
                )}
                <div className="mb-4 space-y-1.5 max-h-48 overflow-y-auto">
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
                        {!isParsed && <span className="ml-auto shrink-0 font-mono text-[9px] text-yellow-600">parsing…</span>}
                      </label>
                    );
                  })}
                </div>

                {error && <p className="mb-3 font-mono text-xs font-bold text-red-600">⚠ {error}</p>}

                <button
                  onClick={handleCreate}
                  disabled={creating || !selectedResumeId || !hasParsed}
                  className="w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
                >
                  {creating ? 'Getting your link ready...' : 'Get my battle link'}
                </button>
              </>
            )}
          </div>
        ) : battle.status === 'WAITING' ? (
          <div className="space-y-4">
            <div className="border-2 border-black bg-white p-5 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="mb-1 font-mono text-xs font-bold uppercase text-text-tertiary">Your link is ready</p>
              <div className="mb-3 flex items-center gap-2 border-2 border-black/15 bg-background px-3 py-2">
                <code className="flex-1 truncate font-mono text-xs text-text-primary">{shareUrlFor(battle.token)}</code>
              </div>
              <button
                onClick={handleCopyLink}
                className="w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {copied ? '✓ Copied' : '🔗 Copy link'}
              </button>
              <p className="mt-3 font-mono text-[10px] text-text-tertiary">
                {polling ? 'Waiting for your opponent to accept...' : 'Send this to whoever you\'re battling.'}
              </p>
            </div>
            <BattleResultCard label={battle.creatorLabel} rank={battle.creatorTopDogRank} subScores={battle.creatorSubScores} you />
          </div>
        ) : (
          <BattleResults battle={battle} />
        )}
      </main>
    </AuthGuard>
  );
}
