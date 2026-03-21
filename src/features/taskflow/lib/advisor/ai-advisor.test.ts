import { describe, it, expect, vi } from "vitest";
import { getInsight, getRecommendation, getAnswer } from "./ai-advisor.js";
import type { AdvisorContext } from "../../types.js";
import type { LocalSummary } from "./local-summary.js";

vi.mock("@/core/ai/client", () => ({
  askClaudeWithRetry: vi.fn(async () => ({
    text: "💡 테스트 인사이트 입니다.",
  })),
}));

const mockContext: AdvisorContext = {
  tasks: [
    { id: "1", title: "Task A", status: "Done", priority: 5, dependencies: [] },
    { id: "2", title: "Task B", status: "Todo", priority: 3, dependencies: ["1"] },
  ],
  decisions: [],
};

const mockSummary: LocalSummary = {
  total: 2,
  done: 1,
  inProgress: 0,
  todo: 1,
  blocked: 0,
  progressPercent: 50,
  groups: { Done: [], InProgress: [], Todo: [], Blocked: [] },
};

describe("getInsight", () => {
  it("should return AI-generated insight string", async () => {
    const result = await getInsight(mockContext, mockSummary);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getRecommendation", () => {
  it("should return AI-generated recommendation string", async () => {
    const result = await getRecommendation(mockContext);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getAnswer", () => {
  it("should return AI-generated answer string", async () => {
    const result = await getAnswer(mockContext, "다음 뭐 해?");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
