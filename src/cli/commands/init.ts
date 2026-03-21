import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { initProject } from "../../core/project/init.js";
import { readConfig, writeConfig } from "../../core/project/config.js";
import { generateClaudeMd, generateMcpJson, appendClaudeImport } from "../../core/project/claude-setup.js";
import { startBrainstorm, continueBrainstorm, savePrd } from "../../core/prd/generator.js";
import { runAutoAnalysis } from "../../core/prd/auto-analyzer.js";

export function registerInitCommand(program: Command) {
  program
    .command("init")
    .description("Initialize a new TaskFlow project (setup + Claude Code integration + PRD)")
    .action(
      withCliErrorBoundary(async () => {
        const cwd = process.cwd();
        const taskflowDir = join(cwd, ".taskflow");
        const alreadyExists = existsSync(taskflowDir);

        if (alreadyExists) {
          await handleReinit(cwd);
        } else {
          await handleNewInit(cwd);
        }
      }),
    );
}

async function handleNewInit(cwd: string): Promise<void> {
  console.log(chalk.bold("\n🚀 TaskFlow 프로젝트를 초기화합니다.\n"));

  // Step 1-2: Create directory + config
  const spinner = ora("프로젝트 구조 생성 중...").start();
  await initProject(cwd);
  spinner.succeed("프로젝트 구조 생성 완료");

  // Step 3: .mcp.json
  const mcpSpinner = ora("Claude Code 연동 설정 중...").start();
  await generateMcpJson(cwd);
  mcpSpinner.succeed("Claude Code 연동 설정 완료 (.mcp.json)");

  // Step 4: PRD generation
  const prdResult = await runPrdGeneration(cwd);

  if (prdResult) {
    // Step 5: Save PRD
    const savePath = await savePrd(cwd, prdResult.markdown);
    console.log(chalk.green(`✔ PRD 저장 완료: ${savePath}`));

    // Update config with project name
    const config = await readConfig(cwd);
    config.project.name = prdResult.meta.projectName;
    await writeConfig(cwd, config);

    // Step 6: Generate CLAUDE.md
    const claudeSpinner = ora("CLAUDE.md 생성 중...").start();
    await generateClaudeMd(cwd, {
      projectName: prdResult.meta.projectName,
    });
    claudeSpinner.succeed("CLAUDE.md 생성 완료");

    // Step 7: Append import to root CLAUDE.md
    await appendClaudeImport(cwd);
    console.log(chalk.green("✔ 루트 CLAUDE.md에 TaskFlow import 추가 완료"));
  }

  console.log(chalk.bold.green("\n✅ TaskFlow 초기화가 완료되었습니다!\n"));
  console.log(chalk.gray("  다음 단계:"));
  console.log(chalk.gray("  $ task parse-prd      PRD를 태스크로 분해"));
  console.log(chalk.gray("  $ task list           태스크 목록 확인"));
  console.log(chalk.gray("  $ task next           다음 태스크 추천\n"));
}

async function handleReinit(cwd: string): Promise<void> {
  console.log(chalk.yellow("\n⚠ TaskFlow 프로젝트가 이미 초기화되어 있습니다.\n"));

  const { action } = await inquirer.prompt<{ action: "prd" | "exit" }>([
    {
      type: "list",
      name: "action",
      message: "무엇을 하시겠습니까?",
      choices: [
        { name: "📝 PRD를 다시 생성합니다", value: "prd" },
        { name: "🚪 종료", value: "exit" },
      ],
    },
  ]);

  if (action === "exit") {
    console.log(chalk.gray("\n👋 종료합니다.\n"));
    return;
  }

  const prdResult = await runPrdGeneration(cwd);

  if (prdResult) {
    const savePath = await savePrd(cwd, prdResult.markdown);
    console.log(chalk.green(`✔ PRD 저장 완료: ${savePath}`));

    // Regenerate CLAUDE.md with updated PRD info
    const config = await readConfig(cwd);
    config.project.name = prdResult.meta.projectName;
    await writeConfig(cwd, config);

    await generateClaudeMd(cwd, {
      projectName: prdResult.meta.projectName,
    });
    console.log(chalk.green("✔ CLAUDE.md 재생성 완료"));
  }
}

async function runPrdGeneration(cwd: string): Promise<{ markdown: string; meta: { projectName: string } } | null> {
  const { mode } = await inquirer.prompt<{ mode: "brainstorm" | "auto" }>([
    {
      type: "list",
      name: "mode",
      message: "PRD 생성 모드를 선택하세요:",
      choices: [
        { name: "1) 대화형 브레인스토밍 (AI와 대화하며 PRD 작성)", value: "brainstorm" },
        { name: "2) AI 자동 분석 (코드베이스 스캔)", value: "auto" },
      ],
    },
  ]);

  if (mode === "auto") {
    const spinner = ora("코드베이스 분석 중...").start();
    try {
      const result = await runAutoAnalysis(cwd);
      spinner.succeed("PRD 자동 생성 완료!");
      return { markdown: result.markdown, meta: { projectName: result.meta.projectName } };
    } catch (error) {
      spinner.fail("PRD 자동 생성 실패");
      console.log(chalk.red(`  ${error instanceof Error ? error.message : "알 수 없는 오류"}`));
      return null;
    }
  }

  // Brainstorm mode
  console.log(chalk.cyan("\n💬 AI 브레인스토밍을 시작합니다. 대화를 통해 PRD를 작성합니다.\n"));
  console.log(chalk.gray("  (종료하려면 CTRL+C를 누르세요)\n"));

  try {
    let turn = await startBrainstorm(cwd);
    console.log(chalk.blue(`\n🤖 AI: ${turn.aiMessage}\n`));

    while (!turn.isComplete) {
      const { answer } = await inquirer.prompt<{ answer: string }>([
        {
          type: "input",
          name: "answer",
          message: "당신:",
          validate: (v: string) => (v.trim() ? true : "응답을 입력하세요."),
        },
      ]);

      const spinner = ora("AI 응답 생성 중...").start();
      turn = await continueBrainstorm(turn.session, answer);
      spinner.stop();

      console.log(chalk.blue(`\n🤖 AI: ${turn.aiMessage}\n`));
    }

    if (turn.prdMarkdown) {
      const nameMatch = turn.prdMarkdown.match(/^#\s+(.+?)(?:\s*—|\s*-|\n)/m);
      const projectName = nameMatch ? nameMatch[1].trim() : "project";
      return { markdown: turn.prdMarkdown, meta: { projectName } };
    }

    return null;
  } catch (error) {
    console.log(chalk.red(`\n브레인스토밍 중 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`));
    return null;
  }
}
