'use client';

import { useMemo } from 'react';

interface SkillTreeProps {
  requiredSkills: string[];
  preferredSkills: string[];
  userSkills: string[];
}

type SkillCategory =
  | 'Languages'
  | 'Frameworks'
  | 'Infrastructure'
  | 'Databases'
  | 'Concepts'
  | 'Other';

interface CategorizedSkill {
  name: string;
  displayName: string;
  category: SkillCategory;
  isRequired: boolean;
  isMatched: boolean;
}

const CATEGORY_MAP: Record<string, SkillCategory> = {
  java: 'Languages',
  python: 'Languages',
  javascript: 'Languages',
  typescript: 'Languages',
  go: 'Languages',
  rust: 'Languages',
  'c++': 'Languages',
  'c#': 'Languages',
  sql: 'Languages',
  r: 'Languages',

  react: 'Frameworks',
  vue: 'Frameworks',
  angular: 'Frameworks',
  node: 'Frameworks',
  express: 'Frameworks',
  spring: 'Frameworks',
  django: 'Frameworks',
  flask: 'Frameworks',
  nextjs: 'Frameworks',
  'next.js': 'Frameworks',

  docker: 'Infrastructure',
  kubernetes: 'Infrastructure',
  aws: 'Infrastructure',
  gcp: 'Infrastructure',
  azure: 'Infrastructure',
  terraform: 'Infrastructure',
  'ci/cd': 'Infrastructure',
  jenkins: 'Infrastructure',
  linux: 'Infrastructure',

  postgresql: 'Databases',
  mysql: 'Databases',
  mongodb: 'Databases',
  redis: 'Databases',
  elasticsearch: 'Databases',
  nosql: 'Databases',

  rest: 'Concepts',
  graphql: 'Concepts',
  grpc: 'Concepts',
  microservices: 'Concepts',
  'distributed systems': 'Concepts',
  agile: 'Concepts',
  'machine learning': 'Concepts',
  ml: 'Concepts',
  ai: 'Concepts',
};

const CATEGORY_ORDER: SkillCategory[] = [
  'Languages',
  'Frameworks',
  'Infrastructure',
  'Databases',
  'Concepts',
  'Other',
];

const CATEGORY_ICONS: Record<SkillCategory, string> = {
  Languages: '⌨',
  Frameworks: '⚙',
  Infrastructure: '☁',
  Databases: '▤',
  Concepts: '◈',
  Other: '★',
};

function categorizeSkill(skill: string): SkillCategory {
  return CATEGORY_MAP[skill.toLowerCase().trim()] ?? 'Other';
}

export default function SkillTree({
  requiredSkills,
  preferredSkills,
  userSkills,
}: SkillTreeProps) {
  const { categorizedSkills, matchCount, totalCount, percentage } = useMemo(() => {
    const userSet = new Set(userSkills.map((s) => s.toLowerCase().trim()));
    const seen = new Map<string, CategorizedSkill>();

    for (const skill of requiredSkills) {
      const key = skill.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, {
          name: key,
          displayName: skill,
          category: categorizeSkill(skill),
          isRequired: true,
          isMatched: userSet.has(key),
        });
      }
    }

    for (const skill of preferredSkills) {
      const key = skill.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, {
          name: key,
          displayName: skill,
          category: categorizeSkill(skill),
          isRequired: false,
          isMatched: userSet.has(key),
        });
      }
    }

    const all = Array.from(seen.values());
    const matched = all.filter((s) => s.isMatched).length;
    const total = all.length;
    const pct = total > 0 ? Math.round((matched / total) * 100) : 0;

    return {
      categorizedSkills: all,
      matchCount: matched,
      totalCount: total,
      percentage: pct,
    };
  }, [requiredSkills, preferredSkills, userSkills]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<SkillCategory, CategorizedSkill[]> = {
      Languages: [],
      Frameworks: [],
      Infrastructure: [],
      Databases: [],
      Concepts: [],
      Other: [],
    };

    for (const skill of categorizedSkills) {
      groups[skill.category].push(skill);
    }

    return CATEGORY_ORDER
      .filter((cat) => groups[cat].length > 0)
      .map((cat) => ({ category: cat, skills: groups[cat] }));
  }, [categorizedSkills]);

  return (
    <div className="border-[3px] border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      {/* Title Bar */}
      <div className="flex items-center justify-between border-b-[3px] border-black bg-primary px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 border-2 border-black bg-white" />
          <h3 className="font-mono text-sm font-bold uppercase tracking-wide text-text-primary">
            SKILL_TREE.RPG
          </h3>
        </div>
        <div className="flex gap-2">
          <div className="flex h-6 w-6 items-center justify-center border-2 border-black bg-white">
            <span className="font-mono text-xs font-bold">_</span>
          </div>
          <div className="flex h-6 w-6 items-center justify-center border-2 border-black bg-white">
            <span className="font-mono text-xs font-bold">□</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6">
        {/* Legend */}
        <div className="mb-6 flex flex-wrap gap-x-5 gap-y-2 border-b-2 border-dashed border-black/20 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 border-[3px] border-black bg-background" />
            <span className="font-mono text-[10px] font-bold uppercase text-text-secondary">
              Required
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-dashed border-black/50 bg-background" />
            <span className="font-mono text-[10px] font-bold uppercase text-text-secondary">
              Preferred
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-success bg-success/20" />
            <span className="font-mono text-[10px] font-bold uppercase text-text-secondary">
              Matched
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-danger/40 bg-danger/10" />
            <span className="font-mono text-[10px] font-bold uppercase text-text-secondary">
              Missing
            </span>
          </div>
        </div>

        {/* Tree Grid */}
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {groupedByCategory.map(({ category, skills }) => (
            <div key={category} className="flex flex-col">
              {/* Category Header */}
              <div className="mb-3 border-b-2 border-black/80 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">
                    {CATEGORY_ICONS[category]}
                  </span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-primary">
                    {category}
                  </span>
                </div>
              </div>

              {/* Skill Nodes */}
              <div className="flex flex-col items-center">
                {skills.map((skill, idx) => (
                  <div key={skill.name} className="flex w-full flex-col items-center">
                    {idx > 0 && (
                      <div className="h-3 w-[2px] bg-black/15" />
                    )}

                    {/* Skill Node */}
                    <div className="group relative w-full">
                      <div
                        className={[
                          'flex items-center justify-between px-2.5 py-1.5',
                          'font-mono text-[11px] transition-all duration-150',
                          skill.isRequired
                            ? 'border-[3px] border-black'
                            : 'border-2 border-dashed border-black/50',
                          skill.isMatched
                            ? 'bg-success/10 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                            : 'bg-danger/5 opacity-60',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'truncate font-bold uppercase',
                            skill.isMatched
                              ? 'text-text-primary'
                              : 'text-text-secondary',
                          ].join(' ')}
                        >
                          {skill.displayName}
                        </span>
                        <span
                          className={[
                            'ml-1.5 flex-shrink-0 text-sm leading-none',
                            skill.isMatched ? 'text-success' : 'text-danger/50',
                          ].join(' ')}
                        >
                          {skill.isMatched ? '✓' : '✗'}
                        </span>
                      </div>

                      {/* Tooltip */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <div className="relative whitespace-nowrap border-2 border-black bg-text-primary px-3 py-1.5 font-mono text-[10px] font-bold text-white shadow-lg">
                          <span>{skill.isRequired ? 'REQUIRED' : 'PREFERRED'}</span>
                          <span className="mx-1.5 text-white/40">|</span>
                          <span className={skill.isMatched ? 'text-success' : 'text-danger'}>
                            {skill.isMatched ? 'MATCHED' : 'MISSING'}
                          </span>
                          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-text-primary" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Summary Bar */}
        <div className="mt-6 border-t-2 border-dashed border-black/20 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              SKILL_MATCH_REPORT:
            </span>
            <div className="flex items-center gap-2 font-mono text-xs font-bold">
              <span
                className={
                  percentage >= 70
                    ? 'text-success'
                    : percentage >= 40
                      ? 'text-secondary'
                      : 'text-danger'
                }
              >
                {matchCount}/{totalCount}
              </span>
              <span className="text-text-primary">SKILLS MATCHED</span>
              <span
                className={[
                  'border-2 px-2 py-0.5 text-[10px]',
                  percentage >= 70
                    ? 'border-success bg-success/10 text-success'
                    : percentage >= 40
                      ? 'border-secondary bg-secondary/10 text-secondary'
                      : 'border-danger bg-danger/10 text-danger',
                ].join(' ')}
              >
                {percentage}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3 h-3 w-full border-2 border-black bg-background">
            <div
              className={[
                'h-full transition-all duration-500',
                percentage >= 70
                  ? 'bg-success'
                  : percentage >= 40
                    ? 'bg-secondary'
                    : 'bg-danger',
              ].join(' ')}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
