import type { AdvisorContext } from "../../types.js";
import type { LocalSummary } from "./local-summary.js";

export async function getInsight(
  _context: AdvisorContext,
  _summary: LocalSummary
): Promise<string> {
  throw new Error("AI 인사이트 기능은 Claude Code 스킬을 통해 제공됩니다.");
}

export async function getRecommendation(_context: AdvisorContext): Promise<string> {
  throw new Error("AI 추천 기능은 Claude Code 스킬을 통해 제공됩니다.");
}

export async function getAnswer(
  _context: AdvisorContext,
  _question: string
): Promise<string> {
  throw new Error("AI 답변 기능은 Claude Code 스킬을 통해 제공됩니다.");
}
