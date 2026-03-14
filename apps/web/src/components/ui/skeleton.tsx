export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-shimmer rounded-lg ${className}`} />
  )
}

export function SkeletonRow({ cols = 1 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-8 h-8 rounded-full shrink-0 animate-shimmer" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded animate-shimmer" />
        <div className="h-3 w-1/2 rounded animate-shimmer" />
      </div>
      {cols > 1 && <div className="h-4 w-16 rounded animate-shimmer" />}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-bg-card border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full shrink-0 animate-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded animate-shimmer" />
          <div className="h-3 w-1/3 rounded animate-shimmer" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonBoard() {
  return (
    <div className="w-full max-w-[576px] aspect-square rounded-xl overflow-hidden">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {Array.from({ length: 64 }, (_, i) => {
          const row = Math.floor(i / 8)
          const col = i % 8
          const isDark = (row + col) % 2 === 1
          return (
            <div
              key={i}
              className={isDark ? 'bg-bg-subtle' : 'bg-bg-card'}
            />
          )
        })}
      </div>
    </div>
  )
}
