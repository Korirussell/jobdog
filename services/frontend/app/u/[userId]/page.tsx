'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { api } from '@/lib/api';

const TIERS = [
  { min: 90, label: 'ALPHA DOG', emoji: '🏆', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', bar: 'bg-emerald-500' },
  { min: 75, label: 'GOOD BOY', emoji: '🐕', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300', bar: 'bg-blue-500' },
  { min: 60, label: 'FETCH PLAYER', emoji: '🦴', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', bar: 'bg-yellow-500' },
  { min: 40, label: 'HOUSE TRAINED', emoji: '🏠', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', bar: 'bg-orange-500' },
  { min: 0, label: 'LOST PUPPY', emoji: '🐾', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300', bar: 'bg-red-400' },
];

function getTier(score: number) {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
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

  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = (display / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="currentColor" strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={`transition-all duration-500 ${tier.color}`}
        />
      </svg>
      <div className="absolute text-center">
        <p className={`font-mono text-2xl font-bold leading-none ${tier.color}`}>{display}</p>
        <p className="font-mono text-[9px] text-text-tertiary">/100</p>
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params?.userId as string;

  const [profile, setProfile] = useState<Awaited<ReturnType<typeof api.getPublicProfile>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    api.getPublicProfile(userId)
      .then(setProfile)
      .catch((e) => setError(e?.message || 'Profile not found'))
      .finally(() => setLoading(false));
  }, [userId]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {loading && (
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse bg-black/5" />
            <div className="h-48 animate-pulse bg-black/5" />
          </div>
        )}

        {error && (
          <div className="border-2 border-red-300 bg-red-50 p-6 text-center">
            <p className="font-mono text-sm font-bold text-red-700">Profile not found</p>
            <p className="mt-1 font-mono text-xs text-red-500">{error}</p>
            <Link href="/" className="mt-4 inline-block font-mono text-xs font-bold underline">
              Browse Jobs →
            </Link>
          </div>
        )}

        {!loading && !error && profile && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-tertiary">JobDog Profile</p>
                <h1 className="mt-1 font-mono text-2xl font-bold text-text-primary">{profile.displayName}</h1>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 border border-black/20 bg-white px-3 py-1.5 font-mono text-[10px] font-bold text-text-secondary transition-colors hover:border-black/40"
              >
                {copied ? '✓ Copied!' : '🔗 Share'}
              </button>
            </div>

            {profile.topScore ? (
              <>
                {/* Score card */}
                {(() => {
                  const tier = getTier(profile.topScore.overallScore);
                  return (
                    <div className={`border-2 p-6 ${tier.border} ${tier.bg}`}>
                      <div className="flex items-center gap-6">
                        <ScoreRing score={profile.topScore.overallScore} />
                        <div>
                          <p className={`font-mono text-lg font-bold ${tier.color}`}>
                            {tier.emoji} {tier.label}
                          </p>
                          <p className="mt-1 font-mono text-xs text-text-secondary">
                            {profile.topScore.targetRole && (
                              <span className="mr-2">Targeting: <strong>{profile.topScore.targetRole}</strong></span>
                            )}
                            {profile.topScore.userLevel && (
                              <span className="capitalize">{profile.topScore.userLevel.toLowerCase()}</span>
                            )}
                          </p>
                          <p className="mt-2 font-mono text-xs text-text-secondary italic">
                            &ldquo;{profile.topScore.summaryVerdict}&rdquo;
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Section scores */}
                {Object.keys(profile.topScore.sectionScores).length > 0 && (
                  <div className="border-2 border-black/10 p-5">
                    <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Section Scores</p>
                    <div className="space-y-3">
                      {Object.entries(profile.topScore.sectionScores).map(([section, score]) => (
                        <div key={section}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-mono text-xs font-bold capitalize text-text-secondary">{section}</span>
                            <span className="font-mono text-xs font-bold text-text-primary">{score}/100</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-black/8">
                            <div
                              className={`h-full rounded-full transition-all ${score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ATS score */}
                <div className="border-2 border-black/10 p-5">
                  <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-wider text-text-tertiary">ATS Readability</p>
                  <div className="flex items-center gap-4">
                    <span className={`font-mono text-3xl font-bold ${profile.topScore.atsScore >= 70 ? 'text-emerald-600' : profile.topScore.atsScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {profile.topScore.atsScore}
                    </span>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-black/8">
                        <div
                          className={`h-full rounded-full ${profile.topScore.atsScore >= 70 ? 'bg-emerald-500' : profile.topScore.atsScore >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                          style={{ width: `${profile.topScore.atsScore}%` }}
                        />
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-text-tertiary">ATS compatibility score</p>
                    </div>
                  </div>
                </div>

                {/* Strengths */}
                {profile.topScore.strengths.length > 0 && (
                  <div className="border-2 border-emerald-200 bg-emerald-50 p-5">
                    <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700">Strengths</p>
                    <ul className="space-y-1.5">
                      {profile.topScore.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 font-mono text-xs text-text-secondary">
                          <span className="mt-0.5 text-emerald-500">✓</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CTA */}
                <div className="border-2 border-primary bg-primary/10 p-5 text-center">
                  <p className="font-mono text-sm font-bold text-text-primary">Want your own JobDog score?</p>
                  <p className="mt-1 font-mono text-xs text-text-secondary">Upload your resume and get FAANG-grade analysis in seconds.</p>
                  <Link
                    href="/vault"
                    className="mt-4 inline-block border-2 border-black bg-primary px-6 py-2 font-mono text-xs font-bold text-text-primary shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]"
                  >
                    Analyze My Resume →
                  </Link>
                </div>
              </>
            ) : (
              <div className="border-2 border-black/10 p-8 text-center">
                <p className="font-mono text-2xl">🐾</p>
                <p className="mt-2 font-mono text-sm font-bold text-text-secondary">No resume analysis yet</p>
                <p className="mt-1 font-mono text-xs text-text-tertiary">This user hasn&apos;t shared a resume score.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
