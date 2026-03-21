import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export interface PrdBrainstormOptions {
  projectRoot: string;
  systemPrompt: string;
  projectContext?: string;
}

export interface PrdBrainstormResult {
  markdown: string;
  projectName: string;
}

/**
 * Run interactive PRD brainstorm using Claude Agent SDK.
 * Claude will ask questions one at a time and generate a PRD.
 * The conversation happens in the terminal via the SDK's built-in I/O.
 */
export async function runPrdBrainstorm(
  options: PrdBrainstormOptions,
): Promise<PrdBrainstormResult | null> {
  const contextSection = options.projectContext
    ? `\n\n## 프로젝트 컨텍스트\n\n${options.projectContext}`
    : "";

  const prompt = `PRD를 작성해주세요. 사용자와 대화하며 요구사항을 수집하고, 완료되면 PRD 마크다운을 생성해주세요.${contextSection}`;

  let prdMarkdown = "";

  const conversation = query({
    prompt,
    options: {
      systemPrompt: options.systemPrompt,
      cwd: options.projectRoot,
      maxTurns: 30,
      model: "claude-sonnet-4-6",
      permissionMode: "default",
    },
  });

  for await (const message of conversation) {
    if (message.type === "assistant") {
      // SDKAssistantMessage: message field is BetaMessage
      // BetaMessage.content is an array of content blocks
      const betaMessage = (message as Extract<SDKMessage, { type: "assistant" }>).message;
      if (betaMessage?.content) {
        for (const block of betaMessage.content) {
          if (block.type === "text") {
            prdMarkdown = block.text;
            process.stdout.write(block.text);
          }
        }
        process.stdout.write("\n");
      }
    } else if (message.type === "result") {
      const resultMsg = message as Extract<SDKMessage, { type: "result" }>;
      if (resultMsg.subtype === "success") {
        // SDKResultSuccess has a `result` field
        const successMsg = resultMsg as Extract<
          Extract<SDKMessage, { type: "result" }>,
          { subtype: "success" }
        >;
        if (successMsg.result) {
          prdMarkdown = successMsg.result;
        }
      }
    }
  }

  if (!prdMarkdown) return null;

  // Extract project name from PRD markdown heading
  const nameMatch = prdMarkdown.match(/^#\s+(.+?)(?:\s*—|\s*-|\n)/m);
  const projectName = nameMatch ? nameMatch[1].trim() : "project";

  return { markdown: prdMarkdown, projectName };
}

export interface TaskCreateOptions {
  projectRoot: string;
  projectContext?: string;
  onFirstMessage?: () => void;
}

export interface TaskCreateResult {
  trdMarkdown: string;
  trdPath: string;
  featureName: string;
  tasksCreated: number;
}

const TASK_CREATE_SYSTEM_PROMPT = `당신은 소프트웨어 기능 요구사항 정의 및 태스크 분해 전문가입니다.

## 역할
사용자와 대화하며 하나의 기능/요구사항을 명확히 정의하고, TRD(Task Requirements Document)를 작성한 뒤, 디테일한 태스크로 분해합니다.

## Phase 1: 요구사항 수집 (대화)
한 번에 하나의 질문만 하세요:
- 어떤 기능을 만들고 싶은지
- 사용자 시나리오 (누가, 언제, 어떻게 사용하는지)
- 기술적 제약사항
- 성공 기준
- 우선순위

## Phase 2: TRD 작성
충분한 정보가 모이면 다음 형식으로 TRD를 작성하세요:

\`\`\`markdown
# {기능명} — TRD

## 개요
(기능 설명)

## 사용자 시나리오
(구체적 시나리오)

## 기술 설계
### 아키텍처
### 데이터 모델
### API 설계
### UI/UX

## 의존성
(다른 기능과의 의존 관계)

## 성공 기준
(테스트 가능한 기준)

## 리스크
(기술적/비즈니스 리스크)
\`\`\`

TRD 작성 후 사용자에게 확인을 받으세요.

## Phase 3: 태스크 분해
TRD를 기반으로 구현 가능한 단위의 태스크로 분해하세요:
- 각 태스크는 4시간 이내에 완료 가능한 크기
- 제목, 상세 설명, 우선순위(0-10), 의존성을 포함
- 태스크 간 의존성을 명시
- 구현 순서를 고려하여 정렬

태스크 목록을 보여주고 사용자 승인을 받으세요.

## 최종 출력
모든 단계가 끝나면 다음 형식으로 최종 결과를 출력하세요:

[TASK_CREATE_COMPLETE]
---TRD_START---
(TRD 마크다운 전체)
---TRD_END---
---TASKS_START---
[
  {"title": "...", "description": "...", "priority": 8, "dependencies": []},
  {"title": "...", "description": "...", "priority": 7, "dependencies": ["task-001"]}
]
---TASKS_END---
---FEATURE_NAME---
{기능명}
---FEATURE_NAME_END---

## 규칙
- 한국어로 대화합니다.
- 한 번에 하나의 질문만 합니다.
- 모호한 답변이면 구체적으로 되물어봅니다.
- 태스크는 최소 3개, 최대 15개로 분해합니다.
`;

export async function runTaskCreate(
  options: TaskCreateOptions,
): Promise<TaskCreateResult | null> {
  const contextSection = options.projectContext
    ? `\n\n## 현재 프로젝트 컨텍스트\n\n${options.projectContext}`
    : "";

  const prompt = `새로운 기능을 만들려고 합니다. 대화를 통해 요구사항을 정의하고, TRD를 작성한 뒤, 태스크로 분해해주세요.${contextSection}`;

  let lastText = "";
  let firstMessageFired = false;

  const conversation = query({
    prompt,
    options: {
      systemPrompt: TASK_CREATE_SYSTEM_PROMPT,
      cwd: options.projectRoot,
      maxTurns: 50,
      model: "claude-sonnet-4-6",
      permissionMode: "default",
    },
  });

  for await (const message of conversation) {
    if (!firstMessageFired && message.type === "assistant") {
      firstMessageFired = true;
      options.onFirstMessage?.();
    }
    if (message.type === "assistant") {
      const betaMessage = (message as Extract<SDKMessage, { type: "assistant" }>).message;
      if (betaMessage?.content) {
        for (const block of betaMessage.content) {
          if (block.type === "text") {
            lastText = block.text;
            process.stdout.write(block.text);
          }
        }
        process.stdout.write("\n");
      }
    } else if (message.type === "result") {
      const resultMsg = message as Extract<SDKMessage, { type: "result" }>;
      if (resultMsg.subtype === "success") {
        const successMsg = resultMsg as Extract<
          Extract<SDKMessage, { type: "result" }>,
          { subtype: "success" }
        >;
        if (successMsg.result) {
          lastText = successMsg.result;
        }
      }
    }
  }

  if (!lastText || !lastText.includes("[TASK_CREATE_COMPLETE]")) return null;

  // Parse TRD
  const trdMatch = lastText.match(/---TRD_START---([\s\S]*?)---TRD_END---/);
  const trdMarkdown = trdMatch ? trdMatch[1].trim() : "";

  // Parse tasks
  const tasksMatch = lastText.match(/---TASKS_START---([\s\S]*?)---TASKS_END---/);
  let tasks: Array<{ title: string; description: string; priority: number; dependencies: string[] }> = [];
  if (tasksMatch) {
    try {
      tasks = JSON.parse(tasksMatch[1].trim());
    } catch {
      // fallback: empty
    }
  }

  // Parse feature name
  const featureMatch = lastText.match(/---FEATURE_NAME---([\s\S]*?)---FEATURE_NAME_END---/);
  const featureName = featureMatch ? featureMatch[1].trim() : "feature";

  // Save TRD
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const safeName = featureName.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-");
  const trdPath = path.join(options.projectRoot, ".taskflow", `trd-${safeName}.md`);
  if (trdMarkdown) {
    await fs.writeFile(trdPath, trdMarkdown, "utf-8");
  }

  // Create tasks via core
  const { createTask } = await import("../task/index.js");
  let created = 0;
  for (const task of tasks) {
    try {
      await createTask(options.projectRoot, {
        title: task.title,
        description: task.description,
        priority: task.priority ?? 0,
        dependencies: task.dependencies,
      });
      created++;
    } catch {
      // skip failed tasks
    }
  }

  return {
    trdMarkdown,
    trdPath,
    featureName,
    tasksCreated: created,
  };
}
