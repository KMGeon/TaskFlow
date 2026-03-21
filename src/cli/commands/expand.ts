import type { Command } from "commander";
import chalk from "chalk";
import { runExpandFlow } from "../flows/brainstorm-flow.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";

export function registerExpandCommand(program: Command) {
  program
    .command("expand")
    .description("브레인스톰 제안을 서브태스크 파일로 생성합니다")
    .argument("<id>", "상위 태스크 ID")
    .option("--apply", "실제 파일을 생성합니다 (없으면 미리보기)")
    .addHelpText(
      "after",
      `
${chalk.bold("사용 예시:")}
  $ task expand 001              서브태스크 미리보기
  $ task expand 001 --apply      서브태스크 파일 생성

${chalk.bold("전제 조건:")}
  먼저 task brainstorm <id>를 실행하여 제안 로그를 생성해야 합니다.

${chalk.bold("출력:")}
  .taskflow/tasks/task-XXX.md    parentId가 설정된 서브태스크 파일
  .taskflow/index/TASKS.md       인덱스 자동 갱신
`,
    )
    .action(
      withCliErrorBoundary(async (id: string, opts: { apply?: boolean }) => {
        await runExpandFlow(id, { apply: opts.apply });
      }),
    );
}
