import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
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

        // Step 1: 사용자 요약 입력 + 백그라운드 코드베이스 스캔 (병렬)
        const scanPromise = (async () => {
          try {
            const files = await scanFiles(cwd);
            if (files.length > 0) {
              const samples = await sampleFiles(files, cwd);
              return JSON.stringify(
                { files, samples: samples.slice(0, 20) },
                null,
                2,
              );
            }
          } catch {
            // 스캔 실패해도 계속 진행
          }
          return "";
        })();

        const { summary } = await inquirer.prompt<{ summary: string }>([
          {
            type: "editor",
            name: "summary",
            message: "만들고 싶은 기능을 설명해주세요 (에디터가 열립니다):",
          },
        ]);

        if (!summary.trim()) {
          console.log(chalk.yellow("\n⚠ 기능 설명이 비어있습니다.\n"));
          return;
        }

        // Step 2: 스캔 결과 대기 + Claude 연결
        const projectContext = await scanPromise;
        const aiSpinner = ora("Claude와 연결 중...").start();

        try {
          const result = await runTaskCreate({
            projectRoot: cwd,
            projectContext,
            userSummary: summary,
            onFirstMessage: () => {
              aiSpinner.succeed("Claude 연결 완료");
              console.log(chalk.cyan("\n💬 추가 질문을 드릴게요...\n"));
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
