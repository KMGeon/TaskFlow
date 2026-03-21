import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { askClaudeWithRetry } from "../ai/client.js";
import type { BrainstormSession, BrainstormTurn, PrdData } from "../types.js";

// ── PRD markdown build ──

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, "\\$1");
}

export function buildPrdMarkdown(data: PrdData): string {
  const painRows = data.pains
    .map((p, i) => {
      const sol = data.solutions[i] ?? "-";
      return `| ${escapeMarkdown(p)} | ${escapeMarkdown(sol)} |`;
    })
    .join("\n");

  const featureRows = [
    ...data.mustFeatures.map((f, i) => `| ${i + 1} | ${escapeMarkdown(f)} | Must-Have |`),
    ...data.optFeatures.map((f, i) => `| ${data.mustFeatures.length + i + 1} | ${escapeMarkdown(f)} | Optional |`),
  ].join("\n");

  const goalList = data.goals.map((g) => `- ${escapeMarkdown(g)}`).join("\n");
  const scenarioList = data.scenarios.map((s, i) => `${i + 1}. ${escapeMarkdown(s)}`).join("\n");
  const nonfuncList = data.nonfunc.map((n) => `- ${escapeMarkdown(n)}`).join("\n");
  const stackList = data.stack.map((s) => `\`${s}\``).join(", ");
  const milestoneList = data.milestones.map((m, i) => `${i + 1}. ${escapeMarkdown(m)}`).join("\n");
  const riskList = data.risks.map((r) => `- ${escapeMarkdown(r)}`).join("\n");

  return `# ${escapeMarkdown(data.projectName)} — PRD

## 1. 제품 개요

${escapeMarkdown(data.summary)}

## 2. 타겟 사용자

${escapeMarkdown(data.target)}

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

${escapeMarkdown(data.scope)}

### 제외

${data.outScope.trim() ? escapeMarkdown(data.outScope) : "\\-"}

## 10. 마일스톤

${milestoneList}

## 11. 리스크 및 완화 전략

${riskList || "\\-"}
`;
}

// ── Brainstorm engine ──

const BRAINSTORM_SYSTEM_PROMPT = `당신은 PRD(Product Requirements Document) 작성 전문가입니다.
사용자와 대화하며 프로젝트 요구사항을 파악합니다.

규칙:
- 한 번에 하나의 질문만 하세요.
- 사용자의 답변을 바탕으로 후속 질문을 동적으로 생성하세요.
- 다음 정보를 모두 파악할 때까지 질문을 계속하세요:
  프로젝트명, 요약, 타겟 사용자, 해결할 문제, 해결 방안, 목표/지표,
  사용 시나리오, 필수 기능, 선택 기능, 비기능 요구사항, 기술 스택,
  범위, 마일스톤, 리스크
- 충분한 정보가 모이면 "[PRD_COMPLETE]" 태그와 함께 PRD 마크다운을 작성하세요.
- PRD는 한국어로 작성하세요.
- PRD 형식은 다음 섹션을 포함해야 합니다:
  1. 제품 개요, 2. 타겟 사용자, 3. 문제 및 솔루션,
  4. 목표/지표, 5. 시나리오, 6. 기능 요구사항(표),
  7. 비기능 요구사항, 8. 기술 스택, 9. 범위, 10. 마일스톤, 11. 리스크`;

export async function startBrainstorm(
  projectRoot: string,
  projectContext?: string,
): Promise<BrainstormTurn> {
  const sessionId = crypto.randomUUID();
  const contextNote = projectContext
    ? `\n\n참고 — 현재 프로젝트 컨텍스트:\n${projectContext}`
    : "";

  const prompt = `새 프로젝트의 PRD를 작성하려고 합니다. 첫 번째 질문을 해주세요.${contextNote}`;

  const response = await askClaudeWithRetry({
    prompt,
    systemPrompt: BRAINSTORM_SYSTEM_PROMPT,
  });

  const isComplete = response.text.includes("[PRD_COMPLETE]");
  const prdMarkdown = isComplete ? extractPrd(response.text) : undefined;

  const session: BrainstormSession = {
    sessionId,
    messages: [
      { role: "user", content: prompt },
      { role: "assistant", content: response.text },
    ],
    isComplete,
  };

  return {
    session,
    aiMessage: response.text.replace("[PRD_COMPLETE]", "").trim(),
    isComplete,
    prdMarkdown,
  };
}

export async function continueBrainstorm(
  session: BrainstormSession,
  userMessage: string,
): Promise<BrainstormTurn> {
  const messagesContext = session.messages
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
    .join("\n\n");

  const prompt = `${messagesContext}\n\n사용자: ${userMessage}`;

  const response = await askClaudeWithRetry({
    prompt,
    systemPrompt: BRAINSTORM_SYSTEM_PROMPT,
  });

  const isComplete = response.text.includes("[PRD_COMPLETE]");
  const prdMarkdown = isComplete ? extractPrd(response.text) : undefined;

  const updatedSession: BrainstormSession = {
    ...session,
    messages: [
      ...session.messages,
      { role: "user", content: userMessage },
      { role: "assistant", content: response.text },
    ],
    isComplete,
  };

  return {
    session: updatedSession,
    aiMessage: response.text.replace("[PRD_COMPLETE]", "").trim(),
    isComplete,
    prdMarkdown,
  };
}

function extractPrd(text: string): string {
  const marker = "[PRD_COMPLETE]";
  const idx = text.indexOf(marker);
  if (idx >= 0) {
    return text.slice(idx + marker.length).trim();
  }
  const headerIdx = text.indexOf("# ");
  if (headerIdx >= 0) {
    return text.slice(headerIdx).trim();
  }
  return text.trim();
}

// ── PRD save ──

export async function savePrd(projectRoot: string, markdown: string): Promise<string> {
  const filePath = path.join(projectRoot, ".taskflow", "prd.md");
  await fs.writeFile(filePath, markdown, "utf-8");
  return filePath;
}
