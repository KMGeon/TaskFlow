import type { Command } from "commander";
import chalk from "chalk";
import { listTasks } from "@/features/taskflow/lib/repository";
import { recommend, detectCycles, type Recommendation } from "@/features/taskflow/lib/graph";
import { truncate } from "../lib/formatter.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import ora from "ora";
import { getAdvisorDbPath } from "@/features/taskflow/constants";
import { AdvisorDb } from "@/features/taskflow/lib/advisor/db";
import { buildContext } from "@/features/taskflow/lib/advisor/context-builder";
import { getRecommendation } from "@/features/taskflow/lib/advisor/ai-advisor";

function formatRecommendationTable(recs: Recommendation[]): string {
  if (recs.length === 0) {
    return chalk.gray("추천할 태스크가 없습니다. 모든 태스크가 완료되었거나 차단되어 있습니다.");
  }

  const lines: string[] = [];
  const SEP = "  ";

  lines.push(
    chalk.gray(`${"#".padEnd(3)}${SEP}${"ID".padEnd(5)}${SEP}${"점수".padEnd(6)}${SEP}${"P".padEnd(3)}${SEP}${"상태".padEnd(12)}${SEP}${"제목"}`),
  );
  lines.push(chalk.gray("─".repeat(72)));

  recs.forEach((rec, i) => {
    const rank = chalk.bold(String(i + 1).padEnd(3));
    const id = rec.task.id.padEnd(5);
    const score = chalk.yellow(String(Math.round(rec.score)).padEnd(6));
    const prio = rec.task.priority >= 8 ? chalk.red(String(rec.task.priority)) : chalk.yellow(String(rec.task.priority));
    const status = rec.task.status === "Blocked" ? chalk.red("Blocked") : rec.task.status === "InProgress" ? chalk.cyan("InProgress") : chalk.white(rec.task.status);
    const title = truncate(rec.task.title, 36);

    lines.push(`${rank}${SEP}${id}${SEP}${score}${SEP}${prio.padEnd(3)}${SEP}${status.padEnd(12)}${SEP}${title}`);

    if (rec.pendingDeps && rec.pendingDeps.length > 0) {
      lines.push(chalk.red(`     차단 원인: ${rec.pendingDeps.join(", ")} 미완료`));
    }
  });

  return lines.join("\n");
}

export function registerNextCommand(program: Command) {
  program
    .command("next")
    .description("다음에 진행할 태스크를 추천합니다")
    .option("--limit <n>", "추천 개수 (기본 5)", parseInt)
    .option("--all", "모든 실행 가능 태스크 표시")
    .option("--include-blocked", "차단된 태스크도 포함 (원인 표시)")
    .option("--json", "JSON 형식으로 출력")
    .action(
      withCliErrorBoundary(
        async (opts: { limit?: number; all?: boolean; includeBlocked?: boolean; json?: boolean }) => {
          const projectRoot = process.cwd();
          const tasks = await listTasks(projectRoot);

          if (tasks.length === 0) {
            console.log(chalk.gray("태스크가 없습니다."));
            return;
          }

          // AI 추천: 플래그 없이 기본 사용 시에만 AI 경로
          const hasFlags = opts.json || opts.all || opts.includeBlocked || opts.limit;

          if (!hasFlags) {
            const spinner = ora("추천 생성 중...").start();
            try {
              const db = await AdvisorDb.open(getAdvisorDbPath(projectRoot));
              const context = await buildContext({ command: "next", projectRoot, db });
              const aiRecommendation = await getRecommendation(context);
              db.persistToDiskAsync();
              db.close();

              spinner.stop();
              console.log("");
              console.log(aiRecommendation);
              console.log("");
              return;
            } catch {
              spinner.stop();
              // AI 실패 — 기존 로컬 추천으로 폴백
            }
          }

          // 사이클 검증
          const cycles = detectCycles(tasks);
          if (cycles.length > 0) {
            console.log(chalk.yellow("⚠ 순환 의존성이 감지되었습니다:"));
            for (const cycle of cycles) {
              console.log(chalk.yellow(`  ${cycle.join(" → ")}`));
            }
            console.log("");
          }

          const recs = recommend(tasks, {
            limit: opts.limit,
            all: opts.all,
            includeBlocked: opts.includeBlocked,
          });

          if (opts.json) {
            const output = recs.map((r) => ({
              id: r.task.id,
              title: r.task.title,
              status: r.task.status,
              priority: r.task.priority,
              score: Math.round(r.score),
              pendingDeps: r.pendingDeps,
            }));
            console.log(JSON.stringify(output, null, 2));
            return;
          }

          console.log("");
          console.log(chalk.bold("추천 태스크:"));
          console.log(formatRecommendationTable(recs));
          console.log("");
        },
      ),
    );
}
