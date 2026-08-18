export interface Tier {
  min: number;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  bar: string;
  desc: string;
}

export const TIERS: Tier[] = [
  { min: 90, label: 'ALPHA DOG', emoji: '🏆', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', bar: 'bg-emerald-500', desc: 'Top 5% of candidates. FAANG-ready.' },
  { min: 75, label: 'GOOD BOY', emoji: '🐕', color: 'text-lime-700', bg: 'bg-lime-50', border: 'border-lime-300', bar: 'bg-lime-500', desc: 'Strong candidate, minor gaps.' },
  { min: 60, label: 'FETCH PLAYER', emoji: '🎾', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', bar: 'bg-amber-500', desc: 'Decent, but clear gaps to close.' },
  { min: 40, label: 'HOUSE TRAINED', emoji: '🏠', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', bar: 'bg-orange-500', desc: 'Needs significant work.' },
  { min: 20, label: 'LOST PUPPY', emoji: '🐾', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', bar: 'bg-red-500', desc: 'Major gaps to address.' },
  { min: 0, label: 'POUND CANDIDATE', emoji: '🐩', color: 'text-red-900', bg: 'bg-red-100', border: 'border-red-400', bar: 'bg-red-700', desc: 'Complete overhaul needed.' },
];

export function getTier(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}

// Roast subScore keys are camelCase field names (see RoastService.computeGrade)
// — display labels for anywhere those get shown to a user, e.g. Battle's
// category-by-category comparison.
export const SUB_SCORE_LABELS: Record<string, string> = {
  requiredSkillCoverage: 'Required Skills',
  preferredSkillCoverage: 'Bonus Skills',
  experienceAlignment: 'Experience',
  educationAlignment: 'Education',
  writingQuality: 'Writing Quality',
};
