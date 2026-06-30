export function PageSkeleton({ cards = 0 }: { cards?: number }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      {/* Title */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-48 rounded-lg bg-bg-2" />
          <div className="mt-2 h-4 w-32 rounded bg-bg-3" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-bg-2" />
      </div>

      {/* Summary cards */}
      {cards > 0 && (
        <div className={`grid grid-cols-1 gap-6 sm:grid-cols-${cards} mb-8`}>
          {Array.from({ length: cards }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-5 rounded-xl bg-card p-6 border border-tile-a"
            >
              <div className="h-14 w-14 shrink-0 rounded-full bg-bg-3" />
              <div className="flex-1">
                <div className="h-3 w-20 rounded bg-bg-3 mb-2" />
                <div className="h-6 w-16 rounded bg-bg-2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table skeleton */}
      <div className="rounded-xl bg-card border border-tile-a overflow-hidden">
        <div className="h-12 bg-bg-3 border-b border-tile-a" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 px-6 py-5 border-b border-tile-a"
          >
            <div className="h-4 w-16 rounded bg-bg-3" />
            <div className="h-4 w-12 rounded bg-bg-3" />
            <div className="h-4 w-20 rounded bg-bg-3" />
            <div className="h-4 w-24 rounded bg-bg-2" />
            <div className="h-4 w-28 rounded bg-bg-3" />
            <div className="ml-auto h-4 w-16 rounded bg-bg-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      {/* Welcome */}
      <div className="h-8 w-64 rounded-lg bg-bg-2 mb-2" />
      <div className="h-4 w-48 rounded bg-bg-3 mb-8" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-6 border border-tile-a">
            <div className="h-3 w-24 rounded bg-bg-3 mb-3" />
            <div className="h-7 w-16 rounded bg-bg-2" />
          </div>
        ))}
      </div>

      {/* Content blocks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-6 border border-tile-a">
            <div className="h-5 w-40 rounded bg-bg-2 mb-4" />
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-bg-3" />
              <div className="h-4 w-3/4 rounded bg-bg-3" />
              <div className="h-4 w-5/6 rounded bg-bg-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpinnerLoading() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-bg-2 border-t-blue" />
    </div>
  );
}
