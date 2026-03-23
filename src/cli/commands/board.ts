import type { Command } from "commander";
import chalk from "chalk";
import { listTasks } from "../../features/taskflow/lib/repository.js";
import { formatKanbanBoard } from "../lib/formatter.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import type { Task } from "../../features/taskflow/types.js";
import { getTrdGroupNames } from "../lib/trd.js";

function formatGroupBoard(tasks: Task[], trdGroupNames: string[]): void {
  const groups = new Map<string, Task[]>();

  // TRD 그룹을 먼저 빈 상태로 등록
  for (const name of trdGroupNames) {
    groups.set(name, []);
  }

  for (const task of tasks) {
    const name = task.group ?? "(그룹 없음)";
    let list = groups.get(name);
    if (!list) {
      list = [];
      groups.set(name, list);
    }
    list.push(task);
  }

  for (const [name, groupTasks] of groups) {
    const done = groupTasks.filter((t) => t.status === "Done").length;
    const total = groupTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    console.log(chalk.bold(`\n── ${name} (${pct}% · ${done}/${total}) ──\n`));
    console.log(formatKanbanBoard(groupTasks, { compact: true }));
  }
}

export function registerBoardCommand(program: Command) {
  program
    .command("board")
    .alias("kb")
    .description("칸반보드 형태로 태스크를 출력합니다 (그룹별)")
    .option("--detail [group]", "특정 그룹의 상세 칸반보드")
    .action(
      withCliErrorBoundary(
        async (opts: { detail?: string | boolean }) => {
          const projectRoot = process.cwd();
          const tasks = await listTasks(projectRoot);
          const trdGroups = getTrdGroupNames(projectRoot);

          if (tasks.length === 0 && trdGroups.length === 0) {
            console.log(chalk.yellow("\n⚠ 태스크가 없습니다.\n"));
            return;
          }

          if (opts.detail !== undefined) {
            const groupFilter = typeof opts.detail === "string" ? opts.detail : undefined;
            const filtered = groupFilter
              ? tasks.filter((t) => t.group?.includes(groupFilter))
              : tasks;

            console.log("");
            console.log(formatKanbanBoard(filtered, { compact: false }));
            console.log("");
            return;
          }

          formatGroupBoard(tasks, trdGroups);
          console.log(chalk.gray("\n  상세 보기: task board --detail [그룹명]\n"));
        },
      ),
    );
}
