"use client";

import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/features/taskflow/types";

type TaskCardProps = {
  task: Task;
};

function priorityBadge(priority: number) {
  if (priority >= 8) return { label: "High", className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" };
  if (priority >= 5) return { label: "Med", className: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" };
  return { label: "Low", className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20" };
}

export function TaskCard({ task }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const badge = priorityBadge(task.priority);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-border/60 p-3 transition-colors hover:border-accent/40 hover:bg-muted/50",
        isDragging && "opacity-50 shadow-lg ring-2 ring-accent",
      )}
      role="listitem"
      aria-label={`태스크: ${task.title}`}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="드래그하여 상태 변경"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug text-foreground truncate">
            {task.title}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">
              #{task.id}
            </span>
            <Badge
              variant="outline"
              className={cn("px-1.5 py-0 text-[10px]", badge.className)}
            >
              {badge.label}
            </Badge>
            {task.dependencies.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                dep: {task.dependencies.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
