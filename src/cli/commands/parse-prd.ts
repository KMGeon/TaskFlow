import type { Command } from "commander";
import chalk from "chalk";
import { runParsePrdFlow } from "../flows/parse-prd-flow.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";

export function registerParsePrdCommand(program: Command) {
  program
    .command("parse-prd")
    .description("PRD 마크다운을 분석하여 태스크를 자동 생성합니다")
    .argument("<path>", "PRD 파일 경로 또는 '-' (표준 입력)")
    .option("--merge", "중복 태스크도 강제 생성합니다")
    .option("--dry-run", "태스크를 생성하지 않고 미리보기만 합니다")
    .option("--out-dir <dir>", "태스크 출력 디렉토리 (기본: 현재 디렉토리)")
    .addHelpText(
      "after",
      `
${chalk.bold("사용 예시:")}
  $ task parse-prd ./docs/prd.md              PRD에서 태스크 자동 생성
  $ task parse-prd ./docs/prd.md --dry-run    생성 없이 미리보기
  $ task parse-prd ./docs/prd.md --merge      중복 무시하고 전부 생성
  $ cat prd.md | task parse-prd -             표준 입력으로 PRD 전달

${chalk.bold("옵션:")}
  --merge       기존 태스크와 중복되어도 강제 생성
  --dry-run     파일을 생성하지 않고 결과만 출력
  --out-dir     .taskflow 디렉토리의 루트 경로 지정

${chalk.bold("출력:")}
  .taskflow/tasks/task-XXX.md   개별 태스크 파일
  .taskflow/index/TASKS.md      인덱스 자동 갱신
`,
    )
    .action(
      withCliErrorBoundary(
        async (
          prdPath: string,
          opts: { merge?: boolean; dryRun?: boolean; outDir?: string },
        ) => {
          await runParsePrdFlow(prdPath, {
            merge: opts.merge,
            dryRun: opts.dryRun,
            outDir: opts.outDir,
          });
        },
      ),
    );
}
