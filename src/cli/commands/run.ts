import * as fs from "node:fs";
import * as path from "node:path";
import type { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { findTrdFiles } from "../lib/trd.js";

function setupRalphLoop(
  projectRoot: string,
  trdContent: string,
  trdName: string,
): void {
  const prompt = `다음 TRD를 기반으로 태스크를 분해하고 모두 구현하세요.

## 단계 1: 태스크 분해
아래 TRD를 읽고 구현 가능한 단위의 태스크로 분해하세요:
- 각 태스크는 4시간 이내에 완료 가능한 크기
- MCP \`create_task\` 도구로 각 태스크를 생성하세요
- group 파라미터에 "${trdName}" 을 설정하세요
- 태스크 간 의존성을 dependencies에 명시하세요
- 태스크 목록을 사용자에게 보여주고 승인을 받으세요

## 단계 2: 순차 구현
태스크가 생성되면 하나씩 순서대로 구현하세요:
1. MCP \`get_next_task\`로 다음 태스크 조회 (group: "${trdName}")
2. MCP \`set_task_status\`로 InProgress 변경
3. 코드 구현 + 테스트 실행
4. MCP \`set_task_status\`로 Done 변경
5. 다음 태스크로 반복

모든 태스크가 완료되면 작업 요약을 출력하세요.

## TRD 내용

${trdContent}`;

  const ralphConfig = `---
active: true
iteration: 1
session_id:
max_iterations: 0
completion_promise: null
started_at: "${new Date().toISOString()}"
---

${prompt}
`;

  const claudeDir = path.join(projectRoot, ".claude");
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(
    path.join(claudeDir, "ralph-loop.local.md"),
    ralphConfig,
    "utf-8",
  );
}

export function registerRunCommand(program: Command) {
  program
    .command("run")
    .description(
      "TRD를 선택하고 Ralph Loop으로 태스크 분해 + 자동 구현합니다",
    )
    .action(
      withCliErrorBoundary(async () => {
        const cwd = process.cwd();

        // 1. TRD 파일 목록 조회
        const trdFiles = findTrdFiles(cwd);

        if (trdFiles.length === 0) {
          console.log(
            chalk.yellow(
              "\n⚠ TRD 파일이 없습니다. /t-create 스킬로 먼저 TRD를 생성하세요.\n",
            ),
          );
          return;
        }

        // 2. TRD 선택 UI
        console.log(chalk.bold("\n📋 TRD 목록:\n"));
        for (let i = 0; i < trdFiles.length; i++) {
          const t = trdFiles[i];
          console.log(`  ${chalk.cyan(`${i + 1})`)} ${t.name}  ${chalk.dim(`(${t.fileName})`)}`);
        }
        console.log();

        let selectedTrd: string;
        if (trdFiles.length === 1) {
          const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
            {
              type: "confirm",
              name: "confirm",
              message: `"${trdFiles[0].name}" TRD를 실행할까요?`,
              default: true,
            },
          ]);
          if (!confirm) return;
          selectedTrd = trdFiles[0].filePath;
        } else {
          const { num } = await inquirer.prompt<{ num: number }>([
            {
              type: "number",
              name: "num",
              message: "번호를 입력하세요:",
              validate: (v: number) =>
                v >= 1 && v <= trdFiles.length
                  ? true
                  : `1~${trdFiles.length} 사이 번호를 입력하세요`,
            },
          ]);
          selectedTrd = trdFiles[num - 1].filePath;
        }

        // 3. TRD 내용 읽기
        const trdContent = fs.readFileSync(selectedTrd, "utf-8");
        const selected = trdFiles.find((t) => t.filePath === selectedTrd)!;

        console.log(
          chalk.bold(
            `\n🚀 "${selected.name}" TRD를 기반으로 자동 구현을 시작합니다.`,
          ),
        );

        // 4. Ralph Loop 셋업
        setupRalphLoop(cwd, trdContent, selected.name);

        console.log(chalk.green("✔ Ralph Loop이 설정되었습니다.\n"));
        console.log(chalk.gray("  다음 단계:"));
        console.log(
          chalk.gray(
            "  Claude Code에서 아무 메시지나 입력하면 Ralph Loop이 시작됩니다.",
          ),
        );
        console.log(
          chalk.gray(
            "  중지하려면: /ralph-loop:cancel-ralph\n",
          ),
        );
      }),
    );
}
