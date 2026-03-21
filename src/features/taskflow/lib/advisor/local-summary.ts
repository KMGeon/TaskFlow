import chalk from "chalk";
import type { Task, TaskStatus } from "../../types.js";

export interface LocalSummary {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  blocked: number;
  progressPercent: number;
  groups: Record<TaskStatus, Task[]>;
}

export function buildLocalSummary(tasks: Task[]): LocalSummary {
  const groups: Record<TaskStatus, Task[]> = {
    Done: [],
    InProgress: [],
    Todo: [],
    Blocked: [],
  };

  for (const task of tasks) {
    groups[task.status].push(task);
  }

  const total = tasks.length;
  const done = groups.Done.length;
  const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    total,
    done,
    inProgress: groups.InProgress.length,
    todo: groups.Todo.length,
    blocked: groups.Blocked.length,
    progressPercent,
    groups,
  };
}

const STATUS_DISPLAY: Record<TaskStatus, { icon: string; label: string; color: (s: string) => string }> = {
  Done:       { icon: "✅", label: "Done",        color: chalk.green },
  InProgress: { icon: "🔵", label: "In Progress", color: chalk.hex("#FFA500") },
  Todo:       { icon: "⬜", label: "Todo",        color: chalk.yellow },
  Blocked:    { icon: "🔴", label: "Blocked",     color: chalk.red },
};

const DISPLAY_ORDER: TaskStatus[] = ["Done", "InProgress", "Blocked", "Todo"];

export function formatStatusOutput(summary: LocalSummary): string {
  const lines: string[] = [];

  lines.push(
    chalk.bold(`📊 프로젝트 진행률: ${summary.done}/${summary.total} (${summary.progressPercent}%)`)
  );
  lines.push("");

  for (const status of DISPLAY_ORDER) {
    const tasks = summary.groups[status];
    if (tasks.length === 0) continue;

    const { icon, label, color } = STATUS_DISPLAY[status];
    lines.push(color(`${icon} ${label} (${tasks.length})`));

    for (const task of tasks) {
      lines.push(chalk.gray(`  ${task.id}. ${task.title}`));
    }
    lines.push("");
  }

  return lines.join("\n");
}
