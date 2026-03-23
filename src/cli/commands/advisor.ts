import type { Command } from "commander";
import chalk from "chalk";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { ensureRepo } from "../../features/taskflow/lib/repository.js";
import { getAdvisorDbPath } from "../../features/taskflow/constants.js";
import { AdvisorDb } from "../../features/taskflow/lib/advisor/db.js";

export function registerAdvisorCommand(program: Command) {
  program
    .command("advisor")
    .description("AI 비서 관리 유틸리티")
    .option("--cleanup", "만료된 대화 로그를 삭제합니다 (기본: 7일)")
    .option("--days <n>", "로그 보관 기간 (일)", parseInt, 7)
    .option("--stats", "DB 통계를 표시합니다")
    .action(
      withCliErrorBoundary(async (opts: { cleanup?: boolean; days: number; stats?: boolean }) => {
        const projectRoot = process.cwd();
        await ensureRepo(projectRoot);

        const db = await AdvisorDb.open(getAdvisorDbPath(projectRoot));

        if (opts.cleanup) {
          const deleted = db.deleteExpiredLogs(opts.days);
          await db.persistToDisk();
          console.log(chalk.green(`✔ ${deleted}개의 만료된 로그를 삭제했습니다.`));
        }

        if (opts.stats) {
          const stats = db.getStats();
          console.log("");
          console.log(chalk.bold("📊 Advisor DB 통계"));
          console.log(`  대화 로그: ${stats.logCount}개`);
          console.log(`  결정 기록: ${stats.decisionCount}개`);
          console.log(`  DB 크기: ${(stats.dbSizeBytes / 1024).toFixed(1)} KB`);
          console.log("");
        }

        if (!opts.cleanup && !opts.stats) {
          console.log(chalk.yellow("옵션을 지정해주세요. --help로 사용법을 확인하세요."));
        }

        db.close();
      })
    );
}
