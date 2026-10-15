'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { sharedResumeUrl, type PublicProfile } from '@/lib/publicProfile';
import { getTier } from '@/lib/tiers';

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

function AtsView({ score }: { score: NonNullable<PublicProfile['topScore']> }) {
  const sections = score.atsParsedSections;
  const fields: { key: keyof NonNullable<typeof sections>; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'contact', label: 'Contact Info' },
    { key: 'education', label: 'Education' },
    { key: 'experience', label: 'Experience' },
    { key: 'projects', label: 'Projects' },
    { key: 'skills', label: 'Skills' },
    { key: 'certifications', label: 'Certifications' },
  ];
  return (
    <div className="space-y-4">
      <div className="border-2 border-black/10 p-5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-tertiary">What an ATS extracts</p>
        <p className="mt-1 font-mono text-xs text-text-tertiary">ATS readability: <strong>{score.atsScore}/100</strong></p>
        <div className="mt-4 space-y-3">
          {sections ? fields.map(({ key, label }) => {
            const val = sections[key];
            if (!val || (Array.isArray(val) && val.length === 0)) return null;
            return (
              <div key={key} className="border border-black/8 p-3">
                <p className="mb-1.5 font-mono text-[10px] font-bold uppercase text-text-tertiary">{label}</p>
                {Array.isArray(val) ? (
                  <ul className="space-y-1">
                    {val.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 font-mono text-xs text-text-secondary">
                        <span className="mt-0.5 text-text-tertiary">·</span>{item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-mono text-xs text-text-secondary">{val}</p>
                )}
              </div>
            );
          }) : (
            <p className="font-mono text-xs text-text-tertiary">No ATS parse is available for this resume.</p>
          )}
        </div>
      </div>
      {score.atsIssues && score.atsIssues.length > 0 && (
        <div className="border border-orange-200 bg-orange-50 p-4">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase text-orange-700">ATS issues</p>
          <ul className="space-y-1.5">
            {score.atsIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 font-mono text-xs text-orange-800">
                <span className="mt-0.5 shrink-0">→</span>{issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ProfileClient({ profile }: { profile: PublicProfile | null }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [tab, setTab] = useState<'score' | 'ats'>('score');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser; the URL bar already
      // has the link, so there's nothing further to do here.
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {!profile && (
          <div className="border-2 border-red-300 bg-red-50 p-6 text-center">
            <p className="font-mono text-sm font-bold text-red-700">Profile not found</p>
            <Link href="/" className="mt-4 inline-block font-mono text-xs font-bold underline">
              Browse Jobs →
            </Link>
          </div>
        )}

        {profile && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-tertiary">JobDog Profile</p>
                <h1 className="mt-1 font-mono text-2xl font-bold text-text-primary">{profile.displayName}</h1>
              </div>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 border border-black/20 bg-white px-3 py-1.5 font-mono text-[10px] font-bold text-text-secondary transition-colors hover:border-black/40"
              >
                {linkCopied ? '✓ Copied' : '🔗 Copy link'}
              </button>
            </div>

            {profile.resumeShared && (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={sharedResumeUrl(profile.userId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-2 border-black bg-primary px-4 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                >
                  View resume ↗
                </a>
                <div className="ml-auto flex border-2 border-black/15">
                  {([['score', 'Score'], ['ats', 'ATS view']] as const).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={`px-3 py-1.5 font-mono text-xs font-bold ${tab === id ? 'bg-primary text-text-primary' : 'bg-white text-text-secondary hover:bg-black/5'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {profile.topScore && tab === 'ats' && profile.resumeShared ? (
              <AtsView score={profile.topScore} />
            ) : profile.topScore ? (
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
                <p className="mt-1 font-mono text-xs text-text-tertiary">No resume score on this profile yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
