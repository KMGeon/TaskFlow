"use client";

import { COLUMN_ORDER, STATUS_CONFIG } from "../lib/kanban-utils";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-border/40 bg-card p-3">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="mt-2 flex gap-2">
        <div className="h-3 w-12 rounded bg-muted" />
        <div className="h-3 w-8 rounded bg-muted" />
      </div>
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {COLUMN_ORDER.map((status) => (
          <div key={status} className="flex w-[280px] shrink-0 flex-col">
            <div className="flex items-center gap-2 px-1 pb-3">
              <div className={`h-2.5 w-2.5 rounded-full ${STATUS_CONFIG[status].dotColor}`} />
              <span className="text-sm font-semibold text-foreground">
                {STATUS_CONFIG[status].label}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 rounded-lg bg-muted/30 p-2">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
