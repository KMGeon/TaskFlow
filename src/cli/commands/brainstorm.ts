import type { Command } from "commander";
import chalk from "chalk";
import { runBrainstormFlow } from "../flows/brainstorm-flow.js";
import { withCliErrorBoundary } from "../lib/error-boundary.js";

export function registerBrainstormCommand(program: Command) {
  program
    .command("brainstorm")
    .description("태스크를 Claude와 토론하여 서브태스크를 제안합니다")
    .argument("<id>", "태스크 ID")
    .addHelpText(
      "after",
      `
${chalk.bold("사용 예시:")}
  $ task brainstorm 001          태스크 #001의 서브태스크 제안
  $ task expand 001 --apply      제안을 실제 파일로 생성

${chalk.bold("출력:")}
  .taskflow/logs/brainstorm-<id>-<date>.json   토론 로그
`,
    )
    .action(
      withCliErrorBoundary(async (id: string) => {
        await runBrainstormFlow(id);
      }),
    );
}
