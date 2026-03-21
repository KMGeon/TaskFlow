import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import { scanFiles, sampleFiles, generateWithAI, withRetry, type FileSample } from "./auto.js";
import { saveMarkdown, slugify } from "./save-markdown.js";

export interface FeaturePrdResult {
  markdown: string;
  meta: Record<string, unknown>;
}

export interface FeatureAnswers {
  projectName: string;
  featureName: string;
  goal: string;
  stories: string;
  reqs: string;
  criteria: string;
  nonfunc: string;
  scope: string;
  risks: string;
  timeline: string;
  autoAnalyze: boolean;
}

const questions: Array<{
  name: keyof FeatureAnswers;
  message: string;
  type?: string;
  default?: unknown;
  validate?: (v: string) => true | string;
}> = [
  {
    name: "projectName",
    message: "프로젝트명을 입력하세요:",
    validate: (v) => (v.trim() ? true : "프로젝트명은 필수 입력입니다."),
  },
  {
    name: "featureName",
    message: "기능명을 입력하세요:",
    validate: (v) => (v.trim() ? true : "기능명은 필수 입력입니다."),
  },
  {
    name: "goal",
    message: "기능의 목적을 한 줄로 설명하세요:",
    validate: (v) => (v.trim() ? true : "목적은 필수 입력입니다."),
  },
  {
    name: "stories",
    message: "사용자 스토리를 나열하세요 (쉼표 구분):",
    validate: (v) => (v.trim() ? true : "최소 하나의 스토리를 입력하세요."),
  },
  {
    name: "reqs",
    message: "기능 요구사항을 나열하세요 (쉼표 구분):",
    validate: (v) => (v.trim() ? true : "최소 하나의 요구사항을 입력하세요."),
  },
  {
    name: "criteria",
    message: "수용 기준을 나열하세요 (쉼표 구분):",
    validate: (v) => (v.trim() ? true : "최소 하나의 수용 기준을 입력하세요."),
  },
  {
    name: "nonfunc",
    message: "비기능 요구사항을 나열하세요 (쉼표 구분, 없으면 빈칸):",
  },
  {
    name: "scope",
    message: "영향 범위(관련 모듈/API)를 설명하세요:",
    validate: (v) => (v.trim() ? true : "영향 범위는 필수 입력입니다."),
  },
  {
    name: "risks",
    message: "리스크와 완화 전략을 나열하세요 (쉼표 구분, 없으면 빈칸):",
  },
  {
    name: "timeline",
    message: "예상 타임라인을 입력하세요 (없으면 빈칸):",
  },
  {
    name: "autoAnalyze",
    type: "confirm",
    message: "코드 자동 분석을 수행할까요? (관련 파일/엔드포인트 분석)",
    default: true,
  },
];

export async function runFeaturePrdFlow(): Promise<FeaturePrdResult> {
  console.log(
    chalk.cyan("\n📋 기능별 PRD 생성을 시작합니다. 질문에 하나씩 답변해주세요.\n"),
  );

  const answers = await collectAnswers();

  let analysisSection = "";
  if (answers.autoAnalyze) {
    const spinner = ora("관련 코드 분석 중...").start();
    try {
      analysisSection = await withRetry(() =>
        analyzeRelated(answers.featureName),
      );
      spinner.succeed(chalk.green("코드 분석 완료"));
    } catch (error) {
      spinner.fail(chalk.yellow("코드 분석을 건너뜁니다."));
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      console.log(chalk.gray(`  원인: ${msg}`));
    }
  }

  const markdown = buildFeatureMarkdown(answers, analysisSection);
  const filename = `features/${slugify(answers.featureName)}.md`;

  const filePath = await saveMarkdown({
    projectName: answers.projectName,
    filename,
    content: markdown,
  });

  return {
    markdown,
    meta: {
      projectName: answers.projectName,
      featureName: answers.featureName,
      savedTo: filePath,
      generatedAt: new Date().toISOString(),
      mode: "feature",
      codeAnalyzed: answers.autoAnalyze,
    },
  };
}

async function collectAnswers(): Promise<FeatureAnswers> {
  const answers: Partial<FeatureAnswers> = {};

  for (const q of questions) {
    const result = await inquirer.prompt<Record<string, unknown>>([
      {
        type: q.type ?? "input",
        name: q.name,
        message: q.message,
        default: q.default,
        validate: q.validate,
      },
    ]);
    (answers as Record<string, unknown>)[q.name] = result[q.name];
  }

  return answers as FeatureAnswers;
}

// ── 코드 분석 ──

export async function analyzeRelated(featureName: string): Promise<string> {
  const cwd = process.cwd();
  const allFiles = await scanFiles(cwd);

  if (allFiles.length === 0) {
    return "";
  }

  // 기능명 키워드 기반 관련 파일 우선 정렬
  const keywords = featureName
    .toLowerCase()
    .split(/[\s-_]+/)
    .filter((k) => k.length > 1);

  const scored = allFiles.map((f) => {
    const lower = f.toLowerCase();
    const score = keywords.reduce(
      (acc, kw) => acc + (lower.includes(kw) ? 1 : 0),
      0,
    );
    return { path: f, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const prioritized = scored.slice(0, 50).map((s) => s.path);
  const samples = await sampleFiles(prioritized, cwd);

  const prompt = buildAnalysisAIPrompt(featureName, samples);
  return generateWithAI(prompt);
}

function buildAnalysisAIPrompt(
  featureName: string,
  samples: FileSample[],
): string {
  const fileList = samples
    .map((s) => {
      const tag = s.truncated ? " [일부 발췌]" : "";
      return `### ${s.path}${tag}\n\`\`\`\n${s.content}\n\`\`\``;
    })
    .join("\n\n");

  return `아래는 "${featureName}" 기능과 관련될 수 있는 프로젝트 소스 코드입니다.

이 코드를 분석하여 다음 내용을 한국어로 요약해주세요:
- 관련 파일 목록 및 역할
- 관련 API 엔드포인트
- 현재 구현 현황 (이미 구현된 부분 / 미구현 부분)
- 기능 구현 시 영향받는 모듈

규칙:
- 실제 코드에서 확인된 사실만 작성하세요.
- 확인할 수 없는 항목은 "N/A (코드에서 확인 불가)"로 표시하세요.
- 추측하지 마세요.

${fileList}`;
}

// ── 마크다운 빌더 ──

function splitComma(text: string): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, "\\$1");
}

export function buildFeatureMarkdown(
  a: FeatureAnswers,
  analysisSection: string,
): string {
  const stories = splitComma(a.stories);
  const reqs = splitComma(a.reqs);
  const criteria = splitComma(a.criteria);
  const nonfunc = splitComma(a.nonfunc);
  const risks = splitComma(a.risks);

  const storyList = stories
    .map((s) => `- ${escapeMarkdown(s)}`)
    .join("\n");
  const reqRows = reqs
    .map((r, i) => `| ${i + 1} | ${escapeMarkdown(r)} |`)
    .join("\n");
  const criteriaList = criteria
    .map((c, i) => `- [ ] ${escapeMarkdown(c)}`)
    .join("\n");
  const nonfuncList = nonfunc
    .map((n) => `- ${escapeMarkdown(n)}`)
    .join("\n");
  const riskList = risks
    .map((r) => `- ${escapeMarkdown(r)}`)
    .join("\n");

  const analysisMd = analysisSection.trim()
    ? `## 4. 코드 분석 결과\n\n${analysisSection}\n`
    : `## 4. 코드 분석 결과\n\nN/A (코드 분석 미수행)\n`;

  return `# ${escapeMarkdown(a.featureName)} — 기능 PRD

> 프로젝트: ${escapeMarkdown(a.projectName)}

## 1. 개요

${escapeMarkdown(a.goal)}

## 2. 사용자 스토리

${storyList}

## 3. 기능 요구사항

| # | 요구사항 |
|---|---|
${reqRows}

${analysisMd}
## 5. 수용 기준

${criteriaList}

## 6. 비기능 요구사항

${nonfuncList || "\\-"}

## 7. 영향 범위

${escapeMarkdown(a.scope)}

## 8. 리스크 및 완화 전략

${riskList || "\\-"}

## 9. 예상 타임라인

${a.timeline?.trim() ? escapeMarkdown(a.timeline) : "\\-"}
`;
}
