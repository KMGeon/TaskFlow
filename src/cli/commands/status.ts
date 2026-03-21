import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { listTasks, ensureRepo } from "@/features/taskflow/lib/repository";
import { getAdvisorDbPath } from "@/features/taskflow/constants";
import { AdvisorDb } from "@/features/taskflow/lib/advisor/db";
import { buildLocalSummary, formatStatusOutput } from "@/features/taskflow/lib/advisor/local-summary";
import { buildContext } from "@/features/taskflow/lib/advisor/context-builder";
import { getInsight } from "@/features/taskflow/lib/advisor/ai-advisor";

export function registerStatusCommand(program: Command) {
  program
    .command("status")
    .description("프로젝트 진행률과 AI 인사이트를 표시합니다")
    .option("--no-ai", "AI 인사이트 없이 로컬 진행률만 표시")
    .action(
      withCliErrorBoundary(async (opts: { ai?: boolean }) => {
        const projectRoot = process.cwd();
        await ensureRepo(projectRoot);

        const tasks = await listTasks(projectRoot);
        if (tasks.length === 0) {
          console.log(chalk.yellow("태스크가 없습니다. `task parse-prd`로 시작하세요."));
          return;
        }

        const summary = buildLocalSummary(tasks);
        console.log(formatStatusOutput(summary));

        if (opts.ai === false) return;

        const spinner = ora("인사이트 생성 중...").start();
        try {
          const db = await AdvisorDb.open(getAdvisorDbPath(projectRoot));
          const context = await buildContext({ command: "status", projectRoot, db });
          const insight = await getInsight(context, summary);
          db.persistToDiskAsync();
          db.close();

          spinner.stop();
          console.log(insight);
        } catch {
          spinner.stop();
          console.log(chalk.gray("💡 인사이트 생성 실패 — 로컬 진행률만 표시합니다."));
        }
      })
    );
}
