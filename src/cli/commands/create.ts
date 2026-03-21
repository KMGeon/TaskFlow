import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { runTaskCreate } from "../../core/ai/claude-client.js";
import { scanFiles, sampleFiles } from "../../core/prd/scanner.js";

export function registerCreateCommand(program: Command) {
  program
    .command("create")
    .description("대화형으로 새 기능을 정의하고 태스크를 생성합니다 (TRD → Task 분해)")
    .action(
      withCliErrorBoundary(async () => {
        const cwd = process.cwd();

        console.log(chalk.bold("\n🚀 새 기능을 만들어봅시다!\n"));
        console.log(chalk.gray("  Claude와 대화하며 요구사항을 정의하고,"));
        console.log(chalk.gray("  TRD를 작성한 뒤, 태스크로 분해합니다.\n"));

        // Scan codebase for context
        const scanSpinner = ora("코드베이스 분석 중...").start();
        let projectContext = "";
        try {
          const files = await scanFiles(cwd);
          if (files.length > 0) {
            const samples = await sampleFiles(files, cwd);
            projectContext = JSON.stringify(
              { files, samples: samples.slice(0, 20) },
              null,
              2,
            );
          }
          scanSpinner.succeed(`코드베이스 분석 완료 (${files.length}개 파일)`);
        } catch {
          scanSpinner.warn("코드베이스 분석 스킵");
        }

        const aiSpinner = ora("Claude 세션 시작 중...").start();

        try {
          const result = await runTaskCreate({
            projectRoot: cwd,
            projectContext,
            onFirstMessage: () => {
              aiSpinner.succeed("Claude 연결 완료");
              console.log(chalk.cyan("\n💬 대화를 시작합니다...\n"));
            },
          });

          if (result) {
            console.log(chalk.bold.green("\n✅ 완료!\n"));
            if (result.trdMarkdown) {
              console.log(chalk.green(`  📄 TRD 저장: ${result.trdPath}`));
            }
            console.log(chalk.green(`  📋 태스크 ${result.tasksCreated}개 생성 완료`));
            console.log(chalk.gray("\n  다음 단계:"));
            console.log(chalk.gray("  task list           태스크 목록 확인"));
            console.log(chalk.gray("  task next           다음 태스크 추천\n"));
          } else {
            console.log(chalk.yellow("\n⚠ 기능 생성이 완료되지 않았습니다."));
            console.log(chalk.gray("  다시 시도하려면 task create를 실행하세요.\n"));
          }
        } catch (error) {
          console.log(
            chalk.red(
              `\n❌ 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
            ),
          );
        }
      }),
    );
}
