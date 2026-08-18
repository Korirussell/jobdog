import { getTier, SUB_SCORE_LABELS } from '@/lib/tiers';
import type { BattleState } from '@/lib/api';

export function BattleResultCard({ label, rank, subScores, you, isWinner }: {
  label?: string; rank?: number; subScores?: Record<string, number>; you?: boolean; isWinner?: boolean;
}) {
  if (rank == null) return null;
  const tier = getTier(rank);
  return (
    <div className={`border-2 p-4 ${isWinner ? 'border-emerald-500 bg-emerald-50' : 'border-black/15 bg-white'}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-text-secondary">{label}{you ? ' (you)' : ''}</span>
        {isWinner && <span className="font-mono text-[10px] font-bold text-emerald-700">🏆 WINNER</span>}
      </div>
      <div className="mb-1 font-mono text-3xl font-bold text-text-primary">{rank}</div>
      <div className="mb-3 font-mono text-xs">{tier.emoji} {tier.label}</div>
      {subScores && (
        <div className="space-y-1">
          {Object.entries(subScores).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between font-mono text-[11px] text-text-secondary">
              <span>{SUB_SCORE_LABELS[key] ?? key}</span>
              <span className="font-bold text-text-primary">{Math.round(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BattleResults({ battle }: { battle: BattleState }) {
  const creatorRank = battle.creatorTopDogRank ?? 0;
  const challengerRank = battle.challengerTopDogRank ?? 0;
  const creatorWins = creatorRank > challengerRank;
  const challengerWins = challengerRank > creatorRank;

  const allKeys = Array.from(new Set([
    ...Object.keys(battle.creatorSubScores ?? {}),
    ...Object.keys(battle.challengerSubScores ?? {}),
  ]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <BattleResultCard label={battle.creatorLabel} rank={battle.creatorTopDogRank} isWinner={creatorWins} />
        <BattleResultCard label={battle.challengerLabel} rank={battle.challengerTopDogRank} isWinner={challengerWins} />
      </div>

      {allKeys.length > 0 && (
        <div className="border-2 border-black/15 bg-white p-4">
          <p className="mb-3 font-mono text-[10px] font-bold uppercase text-text-tertiary">Category breakdown</p>
          <div className="space-y-2.5">
            {allKeys.map((key) => {
              const a = battle.creatorSubScores?.[key];
              const b = battle.challengerSubScores?.[key];
              const aWins = a != null && b != null && a > b;
              const bWins = a != null && b != null && b > a;
              return (
                <div key={key}>
                  <p className="mb-1 font-mono text-[10px] text-text-tertiary">{SUB_SCORE_LABELS[key] ?? key}</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-10 shrink-0 text-right font-mono text-xs font-bold ${aWins ? 'text-emerald-600' : 'text-text-secondary'}`}>
                      {a != null ? Math.round(a) : '—'}
                    </span>
                    <div className="flex h-2 flex-1 flex-row-reverse overflow-hidden border border-black/15">
                      <div className="bg-primary" style={{ width: `${a ?? 0}%` }} />
                    </div>
                    <div className="flex h-2 flex-1 overflow-hidden border border-black/15">
                      <div className="bg-primary" style={{ width: `${b ?? 0}%` }} />
                    </div>
                    <span className={`w-10 shrink-0 font-mono text-xs font-bold ${bWins ? 'text-emerald-600' : 'text-text-secondary'}`}>
                      {b != null ? Math.round(b) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
