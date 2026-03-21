import type { Command } from "commander";
import { listTasks } from "@/features/taskflow/lib/repository";
import { formatDependencyTree } from "../lib/formatter.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";

export function registerTreeCommand(program: Command) {
  program
    .command("tree")
    .description("의존성 트리를 출력합니다")
    .option("--root <id>", "특정 태스크를 루트로 지정")
    .option("--depth <n>", "최대 깊이 제한", parseInt)
    .action(
      withCliErrorBoundary(
        async (opts: { root?: string; depth?: number }) => {
          const projectRoot = process.cwd();
          const tasks = await listTasks(projectRoot);

          console.log("");
          console.log(formatDependencyTree(tasks, { rootId: opts.root, maxDepth: opts.depth }));
          console.log("");
        },
      ),
    );
}
