import { describe, it, expect } from "vitest";
import { getInsight, getRecommendation, getAnswer } from "./ai-advisor.js";
import type { AdvisorContext } from "../../types.js";
import type { LocalSummary } from "./local-summary.js";

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
  it("should throw when AI client is unavailable", async () => {
    await expect(getInsight(mockContext, mockSummary)).rejects.toThrow();
  });
});

describe("getRecommendation", () => {
  it("should throw when AI client is unavailable", async () => {
    await expect(getRecommendation(mockContext)).rejects.toThrow();
  });
});

describe("getAnswer", () => {
  it("should throw when AI client is unavailable", async () => {
    await expect(getAnswer(mockContext, "다음 뭐 해?")).rejects.toThrow();
  });
});
