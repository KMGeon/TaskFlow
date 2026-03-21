import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import { runInteractivePrd } from "./interactive.js";
import { runAutoPrd } from "./auto.js";

export interface PrdResult {
  markdown: string;
  meta: Record<string, unknown>;
}

export async function runPrdFlow(): Promise<PrdResult> {
  console.log(chalk.bold("\n📝 PRD 생성 플로우를 시작합니다.\n"));

  const { mode } = await inquirer.prompt<{ mode: "interactive" | "auto" }>([
    {
      type: "list",
      name: "mode",
      message: "PRD 생성 모드를 선택하세요:",
      choices: [
        { name: "1) 대화형 (추천)", value: "interactive" },
        { name: "2) AI 자동 분석 (고급)", value: "auto" },
      ],
    },
  ]);

  const spinner = ora("PRD 생성 준비 중...").start();

  try {
    const result =
      mode === "interactive"
        ? await runInteractivePrd()
        : await runAutoPrd();

    spinner.succeed(chalk.green("PRD 생성이 완료되었습니다!"));
    return result;
  } catch (error) {
    spinner.fail(chalk.red("PRD 생성 중 오류가 발생했습니다."));

    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    console.log(chalk.gray(`  원인: ${message}`));

    const { retry } = await inquirer.prompt<{ retry: boolean }>([
      {
        type: "confirm",
        name: "retry",
        message: "다시 시도하시겠습니까?",
        default: false,
      },
    ]);

    if (retry) {
      return runPrdFlow();
    }

    console.log(chalk.yellow("\n👋 PRD 생성을 종료합니다. 언제든 다시 시도해주세요!\n"));
    process.exit(0);
  }
}
