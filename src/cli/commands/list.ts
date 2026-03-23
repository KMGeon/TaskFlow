import type { Command } from "commander";
import chalk from "chalk";
import { listTasks } from "../../features/taskflow/lib/repository.js";
import { formatTaskTable, formatDashboard } from "../lib/formatter.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import type { Task, TaskStatus, TaskSortKey, TaskSortOrder } from "../../features/taskflow/types.js";
import { TASK_STATUSES } from "../../features/taskflow/types.js";
import { getTrdGroupNames } from "../lib/trd.js";

function parseStatus(value: string): TaskStatus {
  if (!(TASK_STATUSES as readonly string[]).includes(value)) {
    throw new Error(
      `유효하지 않은 상태입니다: ${value}\n  허용: ${TASK_STATUSES.join(", ")}`,
    );
  }
  return value as TaskStatus;
}

function formatGroupList(tasks: Task[], trdGroupNames: string[]): void {
  const groups = new Map<string, { total: number; done: number; inProgress: number; blocked: number }>();

  // TRD 그룹을 먼저 빈 상태로 등록
  for (const name of trdGroupNames) {
    groups.set(name, { total: 0, done: 0, inProgress: 0, blocked: 0 });
  }

  for (const task of tasks) {
    const name = task.group ?? "(그룹 없음)";
    let g = groups.get(name);
    if (!g) {
      g = { total: 0, done: 0, inProgress: 0, blocked: 0 };
      groups.set(name, g);
    }
    g.total++;
    if (task.status === "Done") g.done++;
    if (task.status === "InProgress") g.inProgress++;
    if (task.status === "Blocked") g.blocked++;
  }

  console.log(chalk.bold("\n📋 요구사항 그룹 목록:\n"));

  for (const [name, g] of groups) {
    const ratio = g.total > 0 ? g.done / g.total : 0;
    const barLen = 10;
    const filled = Math.round(ratio * barLen);
    const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(barLen - filled));
    const pct = Math.round(ratio * 100);

    let status = "";
    if (g.total === 0) {
      status = chalk.dim("태스크 없음 — task run으로 시작");
    } else if (g.done === g.total) {
      status = chalk.green("완료!");
    } else {
      const parts: string[] = [`${g.done}/${g.total}`];
      if (g.inProgress > 0) parts.push(chalk.hex("#FFA500")(`${g.inProgress} 진행중`));
      if (g.blocked > 0) parts.push(chalk.red(`${g.blocked} 블로커`));
      status = parts.join(" · ");
    }

    console.log(`  ${bar}  ${chalk.bold(name)}  ${chalk.gray(`${pct}%`)}  ${status}`);
  }

  console.log(chalk.gray(`\n총 ${groups.size}개 그룹, ${tasks.length}개 태스크`));
}

export function registerListCommand(program: Command) {
  program
    .command("list")
    .alias("ls")
    .description("태스크 목록을 출력합니다")
    .option("--detail [group]", "개별 태스크 상세 보기 (그룹명 지정 가능)")
    .option("--status <status>", "상태로 필터 (Todo, InProgress, Blocked, Done)")
    .option("--priority <n>", "우선순위로 필터", parseInt)
    .option("--dep <id>", "특정 태스크에 의존하는 태스크만 표시")
    .option("--updated-since <date>", "지정 날짜 이후 업데이트된 태스크만 (YYYY-MM-DD)")
    .option("--sort <key>", "정렬 기준 (priority, status, createdAt, updatedAt, title)", "priority")
    .option("--order <dir>", "정렬 방향 (asc, desc)", "desc")
    .action(
      withCliErrorBoundary(
        async (opts: {
          detail?: string | boolean;
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

          // --detail: 개별 태스크 보기
          if (opts.detail !== undefined) {
            const groupFilter = typeof opts.detail === "string" ? opts.detail : undefined;
            const filtered = groupFilter
              ? tasks.filter((t) => t.group?.includes(groupFilter))
              : tasks;

            // Dashboard
            const dashboard = formatDashboard(filtered);
            if (dashboard) {
              console.log("");
              console.log(dashboard);
            }

            console.log("");
            console.log(formatTaskTable(filtered));
            console.log("");
            console.log(chalk.gray(`총 ${filtered.length}건`));
            return;
          }

          // 기본: 그룹 단위 보기
          const trdGroups = getTrdGroupNames(projectRoot);
          if (tasks.length === 0 && trdGroups.length === 0) {
            console.log(chalk.yellow("\n⚠ 태스크가 없습니다.\n"));
            return;
          }

          formatGroupList(tasks, trdGroups);
          console.log(chalk.gray("\n  개별 태스크 보기: task list --detail [그룹명]\n"));
        },
      ),
    );
}
