import type { Command } from "commander";
import chalk from "chalk";
import { runRefineFlow } from "../flows/refine-flow.js";
import { RefineValidationError } from "../flows/refine-config.js";
import type { RefineCliOptions } from "../flows/refine-types.js";

export function registerRefineCommand(program: Command) {
  program
    .command("refine")
    .description("태스크 변경을 분석하고 정제합니다")
    .option("--base <file>", "기준 파일 경로")
    .option("--changed <file>", "변경 파일 경로")
    .option("--stdin", "표준 입력으로 읽기")
    .option("--format <fmt>", "출력 포맷 (table, json, md)", "table")
    .option("--apply", "변경 사항을 자동으로 적용")
    .option("--interactive", "대화형으로 변경 확인 후 적용")
    .option("--dry-run", "실행 시뮬레이션 (파일 변경 없음)")
    .option("--backup-dir <dir>", "백업 디렉토리", ".taskflow/backups")
    .option("--log-level <level>", "로그 레벨 (debug, info, warn, error, silent)", "info")
    .option("--timeout-ms <n>", "타임아웃 (밀리초)", parseInt)
    .option("--no-color", "색상 비활성화")
    .option("--verbose", "상세 로그 출력")
    .addHelpText(
      "after",
      `
${chalk.bold("사용 예시:")}
  $ task refine --base old.md --changed new.md        파일 비교 모드
  $ task refine --changed updated.md --apply           자동 적용
  $ cat diff.md | task refine --stdin --format json    표준 입력 + JSON
  $ task refine --changed new.md --interactive         대화형 적용
  $ task refine --changed new.md --dry-run             실행 시뮬레이션

${chalk.bold("상호 배타 규칙:")}
  --stdin 사용 시 --base/--changed 사용 불가
  --apply 사용 시 --interactive 사용 불가
  --dry-run 사용 시 --apply 사용 불가

${chalk.bold("설정 우선순위:")}
  CLI 옵션 > .taskflow/config.json > 기본값
`,
    )
    .action(async (opts: RefineCliOptions & { verbose?: boolean }) => {
      try {
        if (opts.verbose) opts.logLevel = "debug";
        await runRefineFlow(opts);
      } catch (error) {
        if (error instanceof RefineValidationError) {
          console.error("");
          console.error(chalk.red(`✖ 옵션 오류: ${error.message}`));
          console.error("");
          process.exitCode = 1;
          return;
        }
        throw error;
      }
    });
}
