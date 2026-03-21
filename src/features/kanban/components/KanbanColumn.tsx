"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { TaskCard } from "./TaskCard";
import { STATUS_CONFIG } from "../lib/kanban-utils";
import type { Task, TaskStatus } from "@/features/taskflow/types";

type KanbanColumnProps = {
  status: TaskStatus;
  tasks: Task[];
};

export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex w-[280px] shrink-0 flex-col" role="group" aria-label={`${config.label} 컬럼`}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <div className={cn("h-2.5 w-2.5 rounded-full", config.dotColor)} />
        <span className="text-sm font-semibold text-foreground">
          {config.label}
        </span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {/* Task list — droppable zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-lg p-2 transition-colors",
          isOver ? "bg-accent/20 ring-2 ring-accent/40" : "bg-muted/30",
        )}
        role="list"
        aria-label={`${config.label} 태스크 목록`}
      >
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            태스크 없음
          </p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}
