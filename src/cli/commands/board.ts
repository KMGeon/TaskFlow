import type { Command } from "commander";
import { listTasks } from "@/features/taskflow/lib/repository";
import { formatKanbanBoard } from "../lib/formatter.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";

export function registerBoardCommand(program: Command) {
  program
    .command("board")
    .alias("kb")
    .description("칸반보드 형태로 태스크를 출력합니다")
    .option("--compact", "간결 모드 (설명 생략)")
    .action(
      withCliErrorBoundary(
        async (opts: { compact?: boolean }) => {
          const projectRoot = process.cwd();
          const tasks = await listTasks(projectRoot);

          console.log("");
          console.log(formatKanbanBoard(tasks, { compact: opts.compact }));
          console.log("");
        },
      ),
    );
}
