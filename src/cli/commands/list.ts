import type { Command } from "commander";
import chalk from "chalk";
import { listTasks } from "@/features/taskflow/lib/repository";
import { formatTaskTable, formatDashboard } from "../lib/formatter.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import type { TaskStatus, TaskSortKey, TaskSortOrder } from "@/features/taskflow/types";
import { TASK_STATUSES } from "@/features/taskflow/types";

function parseStatus(value: string): TaskStatus {
  if (!(TASK_STATUSES as readonly string[]).includes(value)) {
    throw new Error(
      `유효하지 않은 상태입니다: ${value}\n  허용: ${TASK_STATUSES.join(", ")}`,
    );
  }
  return value as TaskStatus;
}

export function registerListCommand(program: Command) {
  program
    .command("list")
    .alias("ls")
    .description("태스크 목록을 출력합니다")
    .option("--status <status>", "상태로 필터 (Todo, InProgress, Blocked, Done)")
    .option("--priority <n>", "우선순위로 필터", parseInt)
    .option("--dep <id>", "특정 태스크에 의존하는 태스크만 표시")
    .option("--updated-since <date>", "지정 날짜 이후 업데이트된 태스크만 (YYYY-MM-DD)")
    .option("--sort <key>", "정렬 기준 (priority, status, createdAt, updatedAt, title)", "priority")
    .option("--order <dir>", "정렬 방향 (asc, desc)", "desc")
    .action(
      withCliErrorBoundary(
        async (opts: {
          status?: string;
          priority?: number;
          dep?: string;
          updatedSince?: string;
          sort?: string;
          order?: string;
        }) => {
          const projectRoot = process.cwd();

          const tasks = await listTasks(projectRoot, {
            filter: {
              status: opts.status ? parseStatus(opts.status) : undefined,
              priority: opts.priority,
              hasDependency: opts.dep,
              updatedSince: opts.updatedSince
                ? new Date(opts.updatedSince).toISOString()
                : undefined,
            },
            sortKey: (opts.sort as TaskSortKey) ?? "priority",
            sortOrder: (opts.order as TaskSortOrder) ?? "desc",
          });

          // Dashboard (only when not filtered)
          const isFiltered = !!(opts.status || opts.priority || opts.dep || opts.updatedSince);
          if (!isFiltered) {
            const allTasks = await listTasks(projectRoot);
            const dashboard = formatDashboard(allTasks);
            if (dashboard) {
              console.log("");
              console.log(dashboard);
            }
          }

          console.log("");
          console.log(formatTaskTable(tasks));
          console.log("");
          console.log(chalk.gray(`총 ${tasks.length}건`));
        },
      ),
    );
}
