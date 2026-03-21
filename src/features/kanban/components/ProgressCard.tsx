"use client";

import { Card } from "@/components/ui/card";
import { CheckCircle2, ListTodo } from "lucide-react";
import { computeProgress, groupByStatus } from "../lib/kanban-utils";
import type { Task } from "@/features/taskflow/types";

type ProgressCardProps = {
  tasks: Task[];
};

export function ProgressCard({ tasks }: ProgressCardProps) {
  const progress = computeProgress(tasks);
  const columns = groupByStatus(tasks);
  const doneCount = columns.Done.length;

  return (
    <Card className="flex items-center gap-4 border-border/60 px-4 py-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium text-foreground">{progress}%</span>
      </div>

      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`완료율 ${progress}%`}
        />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ListTodo className="h-3.5 w-3.5" />
        <span>{doneCount}/{tasks.length}</span>
      </div>
    </Card>
  );
}
