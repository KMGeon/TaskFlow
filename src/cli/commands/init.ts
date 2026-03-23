import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import type { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { withCliErrorBoundary } from "../lib/error-boundary.js";
import { initProject } from "../../core/project/init.js";
import { readConfig, writeConfig } from "../../core/project/config.js";
import { generateClaudeMd, generateMcpJson, appendClaudeImport, appendDocsReference, setupPlugins } from "../../core/project/claude-setup.js";
import { installSkills } from "../../core/project/skill-setup.js";
import { installDocs } from "../../core/project/docs-setup.js";
import { SKILL_TEMPLATES } from "../../core/project/skill-templates.js";
import { scanFiles, sampleFiles } from "../../core/prd/scanner.js";
import { savePrd } from "../../core/prd/generator.js";
import { runPrdBrainstorm } from "../../core/ai/claude-client.js";

export function registerInitCommand(program: Command) {
  program
    .command("init")
    .description("Initialize a new TaskFlow project (setup + Claude Code integration)")
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

  // Step 1: Create directory + config
  const spinner = ora("프로젝트 구조 생성 중...").start();
  await initProject(cwd);
  spinner.succeed("프로젝트 구조 생성 완료");

  // Step 2: .mcp.json
  const mcpSpinner = ora("Claude Code 연동 설정 중...").start();
  await generateMcpJson(cwd);
  mcpSpinner.succeed("Claude Code 연동 설정 완료 (.mcp.json)");

  // Step 3: Generate CLAUDE.md
  const config = await readConfig(cwd);
  const claudeSpinner = ora("CLAUDE.md 생성 중...").start();
  await generateClaudeMd(cwd, { projectName: config.project.name || basename(cwd) });
  claudeSpinner.succeed("CLAUDE.md 생성 완료");

  // Step 4: Append import to root CLAUDE.md
  await appendClaudeImport(cwd);
  console.log(chalk.green("✔ 루트 CLAUDE.md에 TaskFlow import 추가 완료"));

  // Step 5: Install docs
  const docsSpinner = ora("개발 가이드라인 문서 생성 중...").start();
  await installDocs(cwd);
  docsSpinner.succeed("개발 가이드라인 문서 생성 완료 (docs/)");

  // Step 5.1: Append docs reference to root CLAUDE.md
  await appendDocsReference(cwd);
  console.log(chalk.green("✔ 루트 CLAUDE.md에 docs 참조 추가 완료"));

  // Step 6: Install skills + symlinks
  const skillSpinner = ora("Claude Code 스킬 설치 중...").start();
  await installSkills(cwd);
  skillSpinner.succeed("Claude Code 스킬 설치 완료");

  // Step 7: Setup plugins (superpowers, ralph-loop)
  const pluginSpinner = ora("Claude Code 플러그인 설정 중...").start();
  await setupPlugins(cwd);
  pluginSpinner.succeed("Claude Code 플러그인 설정 완료 (superpowers, ralph-loop)");

  // Step 6: PRD generation
  const { generatePrd } = await inquirer.prompt<{ generatePrd: boolean }>([
    {
      type: "confirm",
      name: "generatePrd",
      message: "PRD를 지금 생성하시겠습니까? (Claude와 대화형으로 진행)",
      default: true,
    },
  ]);

  if (generatePrd) {
    console.log(chalk.cyan("\n💬 PRD 브레인스토밍을 시작합니다...\n"));

    // Scan codebase for context
    const scanSpinner = ora("코드베이스 분석 중...").start();
    let projectContext = "";
    try {
      const files = await scanFiles(cwd);
      if (files.length > 0) {
        const samples = await sampleFiles(files, cwd);
        projectContext = JSON.stringify({ files, samples: samples.slice(0, 20) }, null, 2);
      }
      scanSpinner.succeed(`코드베이스 분석 완료 (${files.length}개 파일)`);
    } catch {
      scanSpinner.warn("코드베이스 분석 스킵");
    }

    try {
      const result = await runPrdBrainstorm({
        projectRoot: cwd,
        systemPrompt: SKILL_TEMPLATES.prd,
        projectContext,
      });

      if (result) {
        await savePrd(cwd, result.markdown);
        console.log(chalk.green("\n✔ PRD 저장 완료: .taskflow/prd.md"));

        // Update config with project name
        const currentConfig = await readConfig(cwd);
        currentConfig.project.name = result.projectName;
        await writeConfig(cwd, currentConfig);
      }
    } catch (error) {
      console.log(chalk.yellow(`\n⚠ PRD 생성 스킵: ${error instanceof Error ? error.message : "알 수 없는 오류"}`));
      console.log(chalk.gray("  나중에 Claude Code에서 /prd 명령어로 생성할 수 있습니다."));
    }
  }

  console.log(chalk.bold.green("\n✅ TaskFlow 초기화가 완료되었습니다!\n"));
  console.log(chalk.gray("  다음 단계 (Claude Code에서):"));
  console.log(chalk.gray("  /prd              PRD 대화형 생성"));
  console.log(chalk.gray("  /parse-prd        PRD → 태스크 분해"));
  console.log(chalk.gray("  /next             다음 태스크 추천\n"));
}

async function handleReinit(cwd: string): Promise<void> {
  console.log(chalk.yellow("\n⚠ TaskFlow 프로젝트가 이미 초기화되어 있습니다.\n"));

  // Re-install docs (create missing docs only)
  const docsSpinner = ora("개발 가이드라인 문서 확인 중...").start();
  await installDocs(cwd);
  docsSpinner.succeed("개발 가이드라인 문서 확인 완료");

  // Re-install skills (update to latest templates)
  const skillSpinner = ora("스킬 업데이트 중...").start();
  await installSkills(cwd);
  skillSpinner.succeed("스킬 업데이트 완료");

  const { regeneratePrd } = await inquirer.prompt<{ regeneratePrd: boolean }>([
    {
      type: "confirm",
      name: "regeneratePrd",
      message: "PRD를 다시 생성하시겠습니까?",
      default: false,
    },
  ]);

  if (regeneratePrd) {
    console.log(chalk.cyan("\n💬 PRD 브레인스토밍을 시작합니다...\n"));

    try {
      const files = await scanFiles(cwd);
      const samples = files.length > 0 ? await sampleFiles(files, cwd) : [];
      const projectContext =
        files.length > 0
          ? JSON.stringify({ files, samples: samples.slice(0, 20) }, null, 2)
          : "";

      const result = await runPrdBrainstorm({
        projectRoot: cwd,
        systemPrompt: SKILL_TEMPLATES.prd,
        projectContext,
      });

      if (result) {
        await savePrd(cwd, result.markdown);
        console.log(chalk.green("\n✔ PRD 저장 완료: .taskflow/prd.md"));
      }
    } catch (error) {
      console.log(chalk.yellow(`\n⚠ PRD 생성 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`));
    }
  }

  console.log(chalk.gray("\n  Claude Code에서 /prd 명령어로도 PRD를 생성/재생성할 수 있습니다.\n"));
}
