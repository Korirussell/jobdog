import { ImageResponse } from '@vercel/og';
import { getTier } from '@/lib/tiers';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawScore = Number(searchParams.get('score') ?? '0');
  const score = Math.max(0, Math.min(100, Number.isFinite(rawScore) ? rawScore : 0));
  const ratio = searchParams.get('ratio') === '9:16' ? '9:16' : '1:1';
  const pros = (searchParams.get('pros') ?? '').split('|').filter(Boolean).slice(0, 3);
  const jobFit = searchParams.get('jobFit');
  const percentile = searchParams.get('percentile');
  const handle = searchParams.get('handle');

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
              <div key={pro} style={{ fontSize: 26, display: 'flex' }}>✓ {pro}</div>
            ))}
          </div>
        )}
      </div>
    ),
    { width, height }
  );
}
