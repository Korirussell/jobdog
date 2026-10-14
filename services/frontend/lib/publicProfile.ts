// Server-side fetch of a shared profile, used by the page and its link preview.
// No auth: the share link works for anyone.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PublicProfile {
  userId: string;
  displayName: string;
  topScore?: {
    overallScore: number;
    atsScore: number;
    sectionScores: Record<string, number>;
    strengths: string[];
    summaryVerdict: string;
    userLevel: string;
    targetRole: string;
    analyzedAt: string;
  };
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!UUID.test(userId)) return null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/profile/${userId}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as PublicProfile;
  } catch {
    return null;
  }
}
