import { ImageResponse } from '@vercel/og';
import { getTier } from '@/lib/tiers';

export const runtime = 'edge';

// JobDog's site palette (services/frontend/app/globals.css), duplicated here
// since Satori can't read CSS custom properties.
const BACKGROUND = '#F4F0EB';
const PRIMARY = '#FFD166';
const TEXT_PRIMARY = '#3E2723';
const TEXT_SECONDARY = '#6D4C41';
const BLACK = '#000000';

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
  // The 9:16 canvas is ~1.8x taller than 1:1 — scale up the content so it fills
  // the frame like a real Story card instead of leaving a small centered island.
  const scale = ratio === '9:16' ? 1.4 : 1;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: BACKGROUND,
          fontFamily: 'monospace',
          padding: 40,
        }}
      >
        {/* Card frame — thick black border + offset shadow, matches the site's card motif. Dominant fill is the site's primary yellow, not white. */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: PRIMARY,
            border: `6px solid ${BLACK}`,
            boxShadow: `16px 16px 0px 0px ${BLACK}`,
            padding: 56,
          }}
        >
          {/* Hero emoji — the tier mascot, the first thing anyone sees */}
          <div style={{ display: 'flex', fontSize: 260 * scale, lineHeight: 1, marginBottom: -16 * scale }}>
            {tier.emoji}
          </div>

          <div style={{ display: 'flex', fontSize: 56 * scale, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: 1, marginTop: 8 * scale }}>
            {tier.label}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 * scale, marginTop: 20 * scale }}>
            <div style={{ display: 'flex', fontSize: 96 * scale, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1 }}>
              {score}
            </div>
            <div style={{ display: 'flex', fontSize: 34 * scale, fontWeight: 700, color: TEXT_SECONDARY }}>/100 resume score</div>
          </div>

          {jobFit && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                border: `4px solid ${BLACK}`,
                padding: '20px 36px',
                marginTop: 36 * scale,
                maxWidth: 820,
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: TEXT_SECONDARY, letterSpacing: 1 }}>
                BEST FIT ROLE
              </div>
              <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: TEXT_PRIMARY, marginTop: 6 }}>
                {jobFit}
              </div>
            </div>
          )}

          {percentile && (
            <div style={{ display: 'flex', fontSize: 28 * scale, fontWeight: 700, color: TEXT_PRIMARY, marginTop: 28 * scale }}>
              Top {percentile}% of JobDog users
            </div>
          )}

          {handle && (
            <div style={{ display: 'flex', fontSize: 26 * scale, color: TEXT_SECONDARY, marginTop: 10 * scale }}>@{handle}</div>
          )}

          {pros.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40 * scale, gap: 14, width: 780 }}>
              {pros.map((pro) => (
                // A rendered square rather than a "✓" text glyph: Satori's default font has no
                // checkmark glyph and renders it as tofu.
                <div key={pro} style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 16, color: TEXT_PRIMARY, fontWeight: 700 }}>
                  <div style={{ display: 'flex', width: 22, height: 22, flexShrink: 0, backgroundColor: '#FFFFFF', border: `2px solid ${BLACK}` }} />
                  {pro}
                </div>
              ))}
            </div>
          )}

          {subScores.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40 * scale, gap: 16, width: 780 }}>
              {subScores.map((entry) => (
                <div key={entry.key} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 24, color: TEXT_SECONDARY, fontWeight: 700, width: 280, display: 'flex' }}>{entry.label}</div>
                  <div
                    style={{
                      display: 'flex',
                      width: 340,
                      height: 22,
                      backgroundColor: '#FFFFFF',
                      border: `2px solid ${BLACK}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        width: (336 * entry.value) / 100,
                        height: 18,
                        backgroundColor: TEXT_PRIMARY,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 24, width: 60, color: TEXT_PRIMARY, fontWeight: 700, display: 'flex' }}>
                    {Math.round(entry.value)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', fontSize: 22 * scale, fontWeight: 700, color: TEXT_SECONDARY, marginTop: 48 * scale, letterSpacing: 2 }}>
            jobdog.dev
          </div>
        </div>
      </div>
    ),
    { width, height }
  );
}
