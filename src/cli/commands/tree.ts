import type { Command } from "commander";
import chalk from "chalk";
import { listTasks } from "../../features/taskflow/lib/repository.js";
import { formatDependencyTree } from "../lib/formatter.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import type { Task } from "../../features/taskflow/types.js";
import { getTrdGroupNames } from "../lib/trd.js";

function formatGroupTree(tasks: Task[], trdGroupNames: string[]): void {
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

    console.log(chalk.bold(`\n── ${name} (${done}/${total}) ──\n`));
    console.log(formatDependencyTree(groupTasks, {}));
  }
}

export function registerTreeCommand(program: Command) {
  program
    .command("tree")
    .description("의존성 트리를 출력합니다 (그룹별)")
    .option("--detail [group]", "특정 그룹의 상세 트리")
    .option("--root <id>", "특정 태스크를 루트로 지정")
    .option("--depth <n>", "최대 깊이 제한", parseInt)
    .action(
      withCliErrorBoundary(
        async (opts: { detail?: string | boolean; root?: string; depth?: number }) => {
          const projectRoot = process.cwd();
          const tasks = await listTasks(projectRoot);
          const trdGroups = getTrdGroupNames(projectRoot);

          if (tasks.length === 0 && trdGroups.length === 0) {
            console.log(chalk.yellow("\n⚠ 태스크가 없습니다.\n"));
            return;
          }

          if (opts.detail !== undefined || opts.root) {
            const groupFilter = typeof opts.detail === "string" ? opts.detail : undefined;
            const filtered = groupFilter
              ? tasks.filter((t) => t.group?.includes(groupFilter))
              : tasks;

            console.log("");
            console.log(formatDependencyTree(filtered, { rootId: opts.root, maxDepth: opts.depth }));
            console.log("");
            return;
          }

          formatGroupTree(tasks, trdGroups);
          console.log(chalk.gray("\n  상세 보기: task tree --detail [그룹명]\n"));
        },
      ),
    );
}
