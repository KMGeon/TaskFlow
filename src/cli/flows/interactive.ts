import inquirer from "inquirer";
import chalk from "chalk";

export interface PrdResult {
  markdown: string;
  meta: Record<string, unknown>;
}

export interface PrdAnswers {
  projectName: string;
  summary: string;
  target: string;
  pains: string;
  solutions: string;
  goals: string;
  scenarios: string;
  mustFeatures: string;
  optFeatures: string;
  nonfunc: string;
  stack: string;
  scope: string;
  outScope: string;
  milestones: string;
  risks: string;
}

const questions: Array<{
  name: keyof PrdAnswers;
  message: string;
  validate?: (v: string) => true | string;
}> = [
  {
    name: "projectName",
    message: "프로젝트명을 입력하세요:",
    validate: (v) => (v.trim() ? true : "프로젝트명은 필수 입력입니다."),
  },
  {
    name: "summary",
    message: "프로젝트 한 줄 요약을 입력하세요:",
    validate: (v) => (v.trim() ? true : "요약은 필수 입력입니다."),
  },
  {
    name: "target",
    message: "타겟 사용자를 설명하세요:",
    validate: (v) => (v.trim() ? true : "타겟 사용자는 필수 입력입니다."),
  },
  {
    name: "pains",
    message: "해결하려는 문제를 나열하세요 (쉼표 구분):",
    validate: (v) => (v.trim() ? true : "최소 하나의 문제를 입력하세요."),
  },
  {
    name: "solutions",
    message: "각 문제의 해결 방안을 나열하세요 (쉼표 구분):",
    validate: (v) => (v.trim() ? true : "최소 하나의 해결 방안을 입력하세요."),
  },
  {
    name: "goals",
    message: "목표/지표를 나열하세요 (쉼표 구분):",
    validate: (v) => (v.trim() ? true : "최소 하나의 목표를 입력하세요."),
  },
  {
    name: "scenarios",
    message: "주요 사용 시나리오를 나열하세요 (쉼표 구분):",
    validate: (v) => (v.trim() ? true : "최소 하나의 시나리오를 입력하세요."),
  },
  {
    name: "mustFeatures",
    message: "Must-Have 기능을 나열하세요 (쉼표 구분):",
    validate: (v) => (v.trim() ? true : "최소 하나의 필수 기능을 입력하세요."),
  },
  {
    name: "optFeatures",
    message: "선택(Optional) 기능을 나열하세요 (쉼표 구분, 없으면 빈칸):",
  },
  {
    name: "nonfunc",
    message: "비기능 요구사항을 나열하세요 (쉼표 구분, 없으면 빈칸):",
  },
  {
    name: "stack",
    message: "기술 스택을 나열하세요 (쉼표 구분):",
    validate: (v) => (v.trim() ? true : "최소 하나의 기술 스택을 입력하세요."),
  },
  {
    name: "scope",
    message: "프로젝트 범위를 요약하세요:",
    validate: (v) => (v.trim() ? true : "범위는 필수 입력입니다."),
  },
  {
    name: "outScope",
    message: "제외 범위를 요약하세요 (없으면 빈칸):",
  },
  {
    name: "milestones",
    message: "마일스톤을 나열하세요 (쉼표 구분):",
    validate: (v) => (v.trim() ? true : "최소 하나의 마일스톤을 입력하세요."),
  },
  {
    name: "risks",
    message: "리스크와 완화 전략을 나열하세요 (쉼표 구분, 없으면 빈칸):",
  },
];

export async function runInteractivePrd(): Promise<PrdResult> {
  console.log(
    chalk.cyan("\n📋 대화형 PRD 생성을 시작합니다. 질문에 하나씩 답변해주세요.\n"),
  );

  let answers = await collectAnswers();

  let confirmed = false;
  while (!confirmed) {
    printSummary(answers);

    const { action } = await inquirer.prompt<{ action: "confirm" | "edit" }>([
      {
        type: "list",
        name: "action",
        message: "위 내용으로 PRD를 생성할까요?",
        choices: [
          { name: "✅ 확인 — PRD를 생성합니다", value: "confirm" },
          { name: "✏️  수정 — 항목을 다시 입력합니다", value: "edit" },
        ],
      },
    ]);

    if (action === "confirm") {
      confirmed = true;
    } else {
      answers = await editAnswers(answers);
    }
  }

  const markdown = buildMarkdown(answers);
  return {
    markdown,
    meta: {
      projectName: answers.projectName,
      generatedAt: new Date().toISOString(),
      mode: "interactive",
    },
  };
}

async function collectAnswers(): Promise<PrdAnswers> {
  const answers: Partial<PrdAnswers> = {};

  for (const q of questions) {
    const result = await inquirer.prompt<Record<string, string>>([
      {
        type: "input",
        name: q.name,
        message: q.message,
        validate: q.validate,
      },
    ]);
    answers[q.name] = result[q.name];
  }

  return answers as PrdAnswers;
}

async function editAnswers(current: PrdAnswers): Promise<PrdAnswers> {
  const fieldChoices = questions.map((q) => ({
    name: `${q.name}: ${truncate(current[q.name], 40)}`,
    value: q.name,
  }));

  const { fields } = await inquirer.prompt<{ fields: Array<keyof PrdAnswers> }>([
    {
      type: "checkbox",
      name: "fields",
      message: "수정할 항목을 선택하세요 (스페이스바로 선택):",
      choices: fieldChoices,
    },
  ]);

  const updated = { ...current };

  for (const fieldName of fields) {
    const q = questions.find((q) => q.name === fieldName)!;
    const result = await inquirer.prompt<Record<string, string>>([
      {
        type: "input",
        name: q.name,
        message: q.message,
        default: current[fieldName],
        validate: q.validate,
      },
    ]);
    updated[fieldName] = result[q.name];
  }

  return updated;
}

function printSummary(answers: PrdAnswers): void {
  console.log(chalk.bold("\n───────────────────────────────────────"));
  console.log(chalk.bold("📄 입력 내용 요약"));
  console.log(chalk.bold("───────────────────────────────────────\n"));

  const labels: Record<keyof PrdAnswers, string> = {
    projectName: "프로젝트명",
    summary: "한 줄 요약",
    target: "타겟 사용자",
    pains: "해결하려는 문제",
    solutions: "해결 방안",
    goals: "목표/지표",
    scenarios: "주요 시나리오",
    mustFeatures: "Must-Have 기능",
    optFeatures: "선택 기능",
    nonfunc: "비기능 요구사항",
    stack: "기술 스택",
    scope: "범위",
    outScope: "제외 범위",
    milestones: "마일스톤",
    risks: "리스크/완화",
  };

  for (const [key, label] of Object.entries(labels)) {
    const value = answers[key as keyof PrdAnswers];
    console.log(`  ${chalk.bold(label)}: ${value || chalk.gray("(없음)")}`);
  }

  console.log();
}

// ── 마크다운 빌더 ──

export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, "\\$1");
}

export function splitComma(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildMarkdown(a: PrdAnswers): string {
  const pains = splitComma(a.pains);
  const solutions = splitComma(a.solutions);
  const goals = splitComma(a.goals);
  const scenarios = splitComma(a.scenarios);
  const mustFeatures = splitComma(a.mustFeatures);
  const optFeatures = splitComma(a.optFeatures);
  const nonfunc = splitComma(a.nonfunc);
  const stack = splitComma(a.stack);
  const milestones = splitComma(a.milestones);
  const risks = splitComma(a.risks);

  const painRows = pains
    .map((p, i) => {
      const sol = solutions[i] ?? "-";
      return `| ${escapeMarkdown(p)} | ${escapeMarkdown(sol)} |`;
    })
    .join("\n");

  const featureRows = [
    ...mustFeatures.map(
      (f, i) => `| ${i + 1} | ${escapeMarkdown(f)} | Must-Have |`,
    ),
    ...optFeatures.map(
      (f, i) =>
        `| ${mustFeatures.length + i + 1} | ${escapeMarkdown(f)} | Optional |`,
    ),
  ].join("\n");

  const goalList = goals.map((g) => `- ${escapeMarkdown(g)}`).join("\n");
  const scenarioList = scenarios
    .map((s, i) => `${i + 1}. ${escapeMarkdown(s)}`)
    .join("\n");
  const nonfuncList = nonfunc.map((n) => `- ${escapeMarkdown(n)}`).join("\n");
  const stackList = stack.map((s) => `\`${s}\``).join(", ");
  const milestoneList = milestones
    .map((m, i) => `${i + 1}. ${escapeMarkdown(m)}`)
    .join("\n");
  const riskList = risks.map((r) => `- ${escapeMarkdown(r)}`).join("\n");

  return `# ${escapeMarkdown(a.projectName)} — PRD

## 1. 제품 개요

${escapeMarkdown(a.summary)}

## 2. 타겟 사용자

${escapeMarkdown(a.target)}

## 3. 해결하려는 문제 및 솔루션

| Pain Point | 해결 방안 |
|---|---|
${painRows}

## 4. 목표 및 핵심 지표

${goalList}

## 5. 주요 사용 시나리오

${scenarioList}

## 6. 기능 요구사항

| # | 기능 | 우선순위 |
|---|---|---|
${featureRows}

## 7. 비기능 요구사항

${nonfuncList || "\\-"}

## 8. 기술 스택

${stackList}

## 9. 범위

### 포함

${escapeMarkdown(a.scope)}

### 제외

${a.outScope.trim() ? escapeMarkdown(a.outScope) : "\\-"}

## 10. 마일스톤

${milestoneList}

## 11. 리스크 및 완화 전략

${riskList || "\\-"}
`;
}

function truncate(text: string, max: number): string {
  if (!text) return "(빈 값)";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
