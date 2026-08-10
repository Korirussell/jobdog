import { ImageResponse } from '@vercel/og';
import { getTier } from '@/lib/tiers';

export const runtime = 'edge';

const SUB_SCORE_LABELS: Record<string, string> = {
  requiredSkillCoverage: 'Required skills',
  preferredSkillCoverage: 'Preferred skills',
  experienceAlignment: 'Experience',
  educationAlignment: 'Education',
  writingQuality: 'Writing quality',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawScore = Number(searchParams.get('score') ?? '0');
  const score = Math.max(0, Math.min(100, Number.isFinite(rawScore) ? rawScore : 0));
  const ratio = searchParams.get('ratio') === '9:16' ? '9:16' : '1:1';
  const pros = (searchParams.get('pros') ?? '').split('|').filter(Boolean).slice(0, 3);
  const jobFit = searchParams.get('jobFit');
  const percentile = searchParams.get('percentile');
  const handle = searchParams.get('handle');

  // subScores encoding: "key:value|key:value", value = 0-100 integer.
  // e.g. subScores=requiredSkillCoverage:67|writingQuality:80
  const subScores = (searchParams.get('subScores') ?? '')
    .split('|')
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.lastIndexOf(':');
      if (idx <= 0) return null;
      const key = pair.slice(0, idx);
      const value = Number(pair.slice(idx + 1));
      if (!Number.isFinite(value)) return null;
      return { key, label: SUB_SCORE_LABELS[key] ?? key, value: Math.max(0, Math.min(100, value)) };
    })
    .filter((entry): entry is { key: string; label: string; value: number } => entry !== null)
    .slice(0, 5);

  const tier = getTier(score);
  const width = 1080;
  const height = ratio === '9:16' ? 1920 : 1080;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: 64,
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.7, display: 'flex' }}>JOBDOG</div>
        <div style={{ fontSize: 220, fontWeight: 700, display: 'flex' }}>{score}</div>
        <div style={{ fontSize: 56, display: 'flex' }}>
          {tier.emoji} {tier.label}
        </div>
        {handle && <div style={{ fontSize: 32, opacity: 0.8, marginTop: 16, display: 'flex' }}>@{handle}</div>}
        {jobFit && <div style={{ fontSize: 32, marginTop: 24, display: 'flex' }}>{jobFit}</div>}
        {percentile && <div style={{ fontSize: 28, opacity: 0.85, display: 'flex' }}>Top {percentile}% of JobDog users</div>}
        {pros.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 32, gap: 8 }}>
            {pros.map((pro) => (
              // A rendered dot rather than a "✓" text glyph: the default OG font has no
              // checkmark glyph and renders it as tofu.
              <div key={pro} style={{ fontSize: 26, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 6, backgroundColor: '#38bdf8' }} />
                {pro}
              </div>
            ))}
          </div>
        )}
        {subScores.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 32, gap: 10, width: 620 }}>
            {subScores.map((entry) => (
              <div key={entry.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 22, opacity: 0.85, width: 240, display: 'flex' }}>{entry.label}</div>
                <div
                  style={{
                    display: 'flex',
                    width: 300,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: (300 * entry.value) / 100,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: '#38bdf8',
                    }}
                  />
                </div>
                <div style={{ fontSize: 22, width: 56, display: 'flex' }}>{Math.round(entry.value)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    { width, height }
  );
}
