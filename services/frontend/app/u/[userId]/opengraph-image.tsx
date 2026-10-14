import { ImageResponse } from 'next/og';
import { fetchPublicProfile } from '@/lib/publicProfile';
import { getTier } from '@/lib/tiers';

export const alt = 'JobDog resume score';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const profile = await fetchPublicProfile(userId);
  const score = profile?.topScore?.overallScore;
  const tier = score !== undefined ? getTier(score) : null;
  const name = profile?.displayName ?? 'JobDog';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: '#fff8dc', padding: 64,
          border: '12px solid #000', fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>JOBDOG.DEV</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
          {score !== undefined && (
            <div
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: 300, height: 300, background: '#facc15', border: '10px solid #000',
              }}
            >
              <div style={{ display: 'flex', fontSize: 170, fontWeight: 800, lineHeight: 1 }}>{score}</div>
              <div style={{ display: 'flex', fontSize: 36, fontWeight: 700 }}>/100</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 700 }}>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 800 }}>{name}</div>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>
              {tier ? tier.label : 'Get your resume scored'}
            </div>
            {profile?.topScore?.targetRole && (
              <div style={{ display: 'flex', fontSize: 30 }}>Targeting {profile.topScore.targetRole}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 30 }}>What is your resume score? Find out free at jobdog.dev</div>
      </div>
    ),
    size,
  );
}
