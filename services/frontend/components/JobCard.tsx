'use client';

interface JobCardProps {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  postedAt: string;
  applyUrl: string;
}

export default function JobCard({
  title,
  company,
  location,
  employmentType,
  applyUrl,
  postedAt,
}: JobCardProps) {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return '1d ago';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    return `${Math.floor(diffInDays / 30)}mo ago`;
  };

  return (
    <div className="card-hover rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {/* Top row: Company + Posted date */}
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-base font-semibold text-gray-900">{company}</h3>
        <span className="text-sm text-gray-500">Posted {formatTimeAgo(postedAt)}</span>
      </div>

      {/* Job title */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>

      {/* Meta row: Location • Type */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
        <span>{location}</span>
        <span className="text-gray-300">•</span>
        <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary-dark">
          {employmentType}
        </span>
      </div>

      {/* View Details link */}
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="
          inline-flex items-center gap-1 text-sm font-medium text-gray-700
          transition-smooth hover:text-gray-900
        "
      >
        View Details
        <span className="transition-smooth group-hover:translate-x-1">→</span>
      </a>
    </div>
  );
}
