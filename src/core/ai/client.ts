import { query } from "@anthropic-ai/claude-agent-sdk";
import type { TaskBrainstormResult } from "../types.js";

export interface AiRequest {
  prompt: string;
  systemPrompt: string;
  maxTurns?: number;
}

export interface AiResponse {
  text: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

export async function askClaude(req: AiRequest): Promise<AiResponse> {
  const conversation = query({
    prompt: req.prompt,
    options: {
      model: DEFAULT_MODEL,
      systemPrompt: req.systemPrompt,
      maxTurns: req.maxTurns ?? 1,
      tools: [],
      permissionMode: "plan",
    },
  });

  let result = "";

  for await (const message of conversation) {
    if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content) {
        if (block.type === "text") {
          result += block.text;
        }
      }
    }
  }

  if (!result.trim()) {
    throw new Error("AI 응답이 비어있습니다.");
  }

  return { text: result };
}

const RETRY_BASE_MS = 1_000;
const MAX_RETRIES = 3;

export async function askClaudeWithRetry(req: AiRequest): Promise<AiResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await askClaude(req);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export async function brainstormTask(
  projectRoot: string,
  taskId: string,
  taskContent: string,
  depth: number = 1,
): Promise<TaskBrainstormResult> {
  const systemPrompt = `당신은 소프트웨어 태스크 분해 전문가입니다.
주어진 태스크를 실행 가능한 서브태스크로 분해하세요.

규칙:
- 각 서브태스크는 독립적으로 실행 가능해야 합니다.
- 우선순위는 0(낮음)~10(높음)으로 지정하세요.
- 의존성이 있으면 다른 서브태스크의 tempId를 참조하세요.
- JSON 형식으로만 응답하세요.

응답 형식:
{
  "subtasks": [
    { "title": "...", "description": "...", "priority": 5, "dependencies": [], "estimate": "1h" }
  ],
  "rationale": "분해 근거"
}`;

  const response = await askClaudeWithRetry({
    prompt: `다음 태스크를 서브태스크로 분해해주세요 (깊이: ${depth}):\n\n${taskContent}`,
    systemPrompt,
  });

  try {
    const parsed = JSON.parse(response.text);
    return parsed as TaskBrainstormResult;
  } catch {
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as TaskBrainstormResult;
    }
    throw new Error("AI 응답을 파싱할 수 없습니다.");
  }
}
