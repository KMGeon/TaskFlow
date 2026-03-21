import type { Task, TaskStatus } from "@/features/taskflow/types";
import { TASK_STATUSES } from "@/features/taskflow/types";

export type ColumnMap = Record<TaskStatus, Task[]>;

export function groupByStatus(tasks: Task[]): ColumnMap {
  const columns: ColumnMap = {
    Todo: [],
    InProgress: [],
    Blocked: [],
    Done: [],
  };

  for (const task of tasks) {
    columns[task.status].push(task);
  }

  return columns;
}

export function computeProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "Done").length;
  return Math.round((done / tasks.length) * 100);
}

export const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; dotColor: string; bgColor: string }
> = {
  Todo: { label: "Todo", dotColor: "bg-slate-400", bgColor: "bg-slate-400/10" },
  InProgress: { label: "In Progress", dotColor: "bg-blue-500", bgColor: "bg-blue-500/10" },
  Blocked: { label: "Blocked", dotColor: "bg-red-500", bgColor: "bg-red-500/10" },
  Done: { label: "Done", dotColor: "bg-green-500", bgColor: "bg-green-500/10" },
};

export const COLUMN_ORDER: TaskStatus[] = [...TASK_STATUSES];
