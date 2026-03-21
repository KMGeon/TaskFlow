import type { Command } from "commander";
import chalk from "chalk";
import { readTask, updateTask } from "@/features/taskflow/lib/repository";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import type { TaskStatus } from "@/features/taskflow/types";
import { TASK_STATUSES } from "@/features/taskflow/types";

function validateStatus(value: string): TaskStatus {
  if (!(TASK_STATUSES as readonly string[]).includes(value)) {
    throw new Error(
      `유효하지 않은 상태입니다: ${value}\n  허용: ${TASK_STATUSES.join(", ")}`,
    );
  }
  return value as TaskStatus;
}

export function registerSetStatusCommand(program: Command) {
  program
    .command("set-status")
    .description("태스크 상태를 변경합니다")
    .argument("<id>", "태스크 ID")
    .requiredOption("--to <status>", "변경할 상태 (Todo, InProgress, Blocked, Done)")
    .action(
      withCliErrorBoundary(async (id: string, opts: { to: string }) => {
        const projectRoot = process.cwd();
        const newStatus = validateStatus(opts.to);

        const existing = await readTask(projectRoot, id);
        if (!existing) {
          console.error(chalk.red(`✖ 태스크를 찾을 수 없습니다: ${id}`));
          process.exitCode = 1;
          return;
        }

        if (existing.status === newStatus) {
          console.log(chalk.yellow(`이미 "${newStatus}" 상태입니다.`));
          return;
        }

        const oldStatus = existing.status;
        const updated = await updateTask(projectRoot, id, { status: newStatus });

        console.log(
          chalk.green(
            `✔ [${updated.id}] ${updated.title}: ${oldStatus} → ${newStatus}`,
          ),
        );
      }),
    );
}
