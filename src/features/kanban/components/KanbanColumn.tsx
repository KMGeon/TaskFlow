import { cn } from "@/lib/utils";
import { TaskCard, type TaskCardData, type TaskStatus } from "./TaskCard";

const statusConfig: Record<
  TaskStatus,
  { label: string; dotColor: string }
> = {
  pending: { label: "Pending", dotColor: "bg-slate-400" },
  "in-progress": { label: "In Progress", dotColor: "bg-blue-500" },
  blocked: { label: "Blocked", dotColor: "bg-red-500" },
  done: { label: "Done", dotColor: "bg-green-500" },
};

type KanbanColumnProps = {
  status: TaskStatus;
  tasks: TaskCardData[];
};

export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const config = statusConfig[status];

  return (
    <div className="flex w-[280px] shrink-0 flex-col">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <div className={cn("h-2.5 w-2.5 rounded-full", config.dotColor)} />
        <span className="text-sm font-semibold text-foreground">
          {config.label}
        </span>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>

      {/* Task list */}
      <div className="flex flex-1 flex-col gap-2 rounded-lg bg-muted/30 p-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
