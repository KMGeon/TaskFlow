import type { Command } from "commander";
import chalk from "chalk";
import { runFeaturePrdFlow } from "../flows/feature-prd-flow.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";

export function registerFprdCommand(program: Command) {
  program
    .command("fprd")
    .description("기능별 PRD 생성 플로우를 시작합니다")
    .addHelpText(
      "after",
      `
${chalk.bold("사용 예시:")}
  $ task fprd           기능별 PRD 생성 플로우를 시작합니다

${chalk.bold("설명:")}
  특정 기능에 대한 PRD를 생성합니다.
  기능명, 목적, 요구사항 등은 실행 중 질문으로 수집합니다.
  선택적으로 코드 자동 분석을 통해 관련 파일/엔드포인트를 요약합니다.

${chalk.bold("저장 경로:")}
  {프로젝트명}-docs/features/{기능명}.md
  • 디렉토리가 없으면 자동 생성됩니다
  • 동일 파일이 있으면 덮어쓰기 여부를 확인합니다

${chalk.bold("단축키:")}
  CTRL+C  현재 작업을 취소하고 안전하게 종료합니다

${chalk.bold("관련 문서:")}
  vooster-docs/prd.md   PRD 작성 가이드라인
`,
    )
    .action(
      withCliErrorBoundary(async () => {
        await runFeaturePrdFlow();
      }),
    );
}
