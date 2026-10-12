import { cn } from '../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('skeleton block rounded-md', className)} />;
}

/** Skeleton za listu redaka. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-card bg-raised p-4 shadow-hairline">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
