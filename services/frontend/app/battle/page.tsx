'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import TopBar from '@/components/TopBar';
import { api } from '@/lib/api';
import { getTier } from '@/lib/tiers';

interface BattleResult {
  resumeId: string;
  label: string;
  topDogRank: number;
  tierName: string;
  subScores: Record<string, number>;
}

export default function BattlePage() {
  const [resumes, setResumes] = useState<Array<{ resumeId: string; label: string }>>([]);
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');
  const [left, setLeft] = useState<BattleResult | null>(null);
  const [right, setRight] = useState<BattleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getResumes().then((res) => setResumes(res.items));
  }, []);

  async function runBattle() {
    if (!leftId || !rightId) return;
    setLoading(true);
    setError(null);
    try {
      const [leftResult, rightResult] = await Promise.all([
        api.roastResume(leftId),
        api.roastResume(rightId),
      ]);
      setLeft({
        resumeId: leftId,
        label: resumes.find((r) => r.resumeId === leftId)?.label ?? 'Resume A',
        topDogRank: leftResult.topDogRank,
        tierName: leftResult.tierName,
        subScores: leftResult.subScores,
      });
      setRight({
        resumeId: rightId,
        label: resumes.find((r) => r.resumeId === rightId)?.label ?? 'Resume B',
        topDogRank: rightResult.topDogRank,
        tierName: rightResult.tierName,
        subScores: rightResult.subScores,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to run battle.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
      <TopBar />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Resume Battle</h1>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)} className="rounded-md border p-2">
            <option value="">Select resume A</option>
            {resumes.map((r) => (
              <option key={r.resumeId} value={r.resumeId}>{r.label}</option>
            ))}
          </select>
          <select value={rightId} onChange={(e) => setRightId(e.target.value)} className="rounded-md border p-2">
            <option value="">Select resume B</option>
            {resumes.map((r) => (
              <option key={r.resumeId} value={r.resumeId}>{r.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={runBattle}
          disabled={!leftId || !rightId || loading}
          className="mb-6 w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Battling…' : 'Battle!'}
        </button>

        {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {left && right && (
          <div className="grid grid-cols-2 gap-4">
            {[left, right].map((side) => {
              const tier = getTier(side.topDogRank);
              const isWinner = left.topDogRank !== right.topDogRank
                && side.topDogRank === Math.max(left.topDogRank, right.topDogRank);
              return (
                <div key={side.resumeId} className={`rounded-lg border p-4 ${isWinner ? 'border-emerald-400 bg-emerald-50' : ''}`}>
                  <div className="mb-1 text-sm text-gray-500">{side.label}</div>
                  <div className="text-3xl font-bold">{side.topDogRank}</div>
                  <div className="mb-3 text-sm">{tier.emoji} {tier.label}</div>
                  {Object.entries(side.subScores).map(([key, value]) => (
                    <div key={key} className="mb-1 flex justify-between text-xs text-gray-600">
                      <span>{key}</span>
                      <span>{Math.round(value * 100) / 100}</span>
                    </div>
                  ))}
                  {isWinner && <div className="mt-2 text-sm font-semibold text-emerald-700">🏆 Winner</div>}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
