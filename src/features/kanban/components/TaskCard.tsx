import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TaskStatus = "pending" | "in-progress" | "blocked" | "done";
export type TaskComplexity = "low" | "medium" | "high";

export type TaskCardData = {
  id: string;
  title: string;
  status: TaskStatus;
  complexity: TaskComplexity;
};

const complexityConfig: Record<
  TaskComplexity,
  { label: string; className: string }
> = {
  low: {
    label: "Low",
    className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",
  },
  medium: {
    label: "Med",
    className: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  },
  high: {
    label: "High",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
  },
};

type TaskCardProps = {
  task: TaskCardData;
};

export function TaskCard({ task }: TaskCardProps) {
  const complexity = complexityConfig[task.complexity];

  return (
    <Card className="cursor-pointer border-border/60 p-3 transition-colors hover:border-accent/40 hover:bg-muted/50">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-foreground">
          {task.title}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] font-mono text-muted-foreground">
          {task.id}
        </span>
        <Badge
          variant="outline"
          className={cn("px-1.5 py-0 text-[10px]", complexity.className)}
        >
          {complexity.label}
        </Badge>
      </div>
    </Card>
  );
}
