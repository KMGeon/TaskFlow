import { askClaudeWithRetry } from "@/core/ai/client";
import type { AdvisorContext } from "../../types.js";
import type { LocalSummary } from "./local-summary.js";
import { buildStatusPrompt, buildNextPrompt, buildAskPrompt } from "./prompts.js";

const ADVISOR_SYSTEM_PROMPT = "너는 개발 프로젝트의 AI 비서야. 태스크 현황을 파악하고, 다음 작업을 추천하고, 프로젝트에 대한 질문에 답변해. 항상 한국어로 답변해.";

export async function getInsight(
  context: AdvisorContext,
  summary: LocalSummary
): Promise<string> {
  const prompt = buildStatusPrompt(context, summary);
  const response = await askClaudeWithRetry({
    prompt,
    systemPrompt: ADVISOR_SYSTEM_PROMPT,
  });
  return response.text.trim();
}

export async function getRecommendation(context: AdvisorContext): Promise<string> {
  const prompt = buildNextPrompt(context);
  const response = await askClaudeWithRetry({
    prompt,
    systemPrompt: ADVISOR_SYSTEM_PROMPT,
  });
  return response.text.trim();
}

export async function getAnswer(
  context: AdvisorContext,
  question: string
): Promise<string> {
  const prompt = buildAskPrompt(context, question);
  const response = await askClaudeWithRetry({
    prompt,
    systemPrompt: ADVISOR_SYSTEM_PROMPT,
  });
  return response.text.trim();
}
