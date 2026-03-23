import type { Command } from "commander";
import chalk from "chalk";
import { readTask } from "../../features/taskflow/lib/repository.js";
import { formatTaskDetail } from "../lib/formatter.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";

export function registerShowCommand(program: Command) {
  program
    .command("show")
    .description("태스크 상세 정보를 출력합니다")
    .argument("<id>", "태스크 ID")
    .action(
      withCliErrorBoundary(async (id: string) => {
        const projectRoot = process.cwd();
        const task = await readTask(projectRoot, id);

        if (!task) {
          console.error(chalk.red(`✖ 태스크를 찾을 수 없습니다: ${id}`));
          process.exitCode = 1;
          return;
        }

        console.log("");
        console.log(formatTaskDetail(task));
        console.log("");
      }),
    );
}
