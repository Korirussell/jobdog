interface PaginationProps {
  // Zero-based, matching the ?page= URL parameter.
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}

// Which page numbers to show: always the first and last, a window around the
// current page, and a gap marker wherever pages were skipped.
function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  const wanted = new Set<number>([0, totalPages - 1]);
  for (let p = page - 2; p <= page + 2; p++) {
    if (p >= 0 && p < totalPages) wanted.add(p);
  }
  const sorted = Array.from(wanted).sort((a, b) => a - b);

  const out: Array<number | 'gap'> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const baseButton =
  'flex h-9 min-w-9 items-center justify-center border px-2 font-mono text-xs font-bold transition-colors';

// Plain links rather than buttons: every page has its own URL, so it can be
// shared, bookmarked, and reached with the back button.
export default function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 0;
  const hasNext = page < totalPages - 1;

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1.5 border-t border-black/8 py-6 pb-20">
      {hasPrev ? (
        <a href={hrefFor(page - 1)} rel="prev" className={`${baseButton} border-black/20 bg-white hover:border-black/40`}>
          ← Prev
        </a>
      ) : (
        <span className={`${baseButton} cursor-not-allowed border-black/10 text-text-tertiary opacity-50`}>← Prev</span>
      )}

      {pageWindow(page, totalPages).map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 font-mono text-xs text-text-tertiary">…</span>
        ) : item === page ? (
          <span
            key={item}
            aria-current="page"
            className={`${baseButton} border-black bg-primary text-text-primary`}
          >
            {item + 1}
          </span>
        ) : (
          <a key={item} href={hrefFor(item)} className={`${baseButton} border-black/20 bg-white text-text-secondary hover:border-black/40 hover:text-text-primary`}>
            {item + 1}
          </a>
        ),
      )}

      {hasNext ? (
        <a href={hrefFor(page + 1)} rel="next" className={`${baseButton} border-black/20 bg-white hover:border-black/40`}>
          Next →
        </a>
      ) : (
        <span className={`${baseButton} cursor-not-allowed border-black/10 text-text-tertiary opacity-50`}>Next →</span>
      )}
    </nav>
  );
}
