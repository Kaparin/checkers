export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-bg-subtle rounded-lg ${className}`} />
  )
}

export function SkeletonRow({ cols = 1 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      {cols > 1 && <Skeleton className="h-4 w-16" />}
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
    <div className="p-4 bg-bg-card border border-border rounded-xl space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
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
