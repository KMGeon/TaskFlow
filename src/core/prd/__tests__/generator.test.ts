import { describe, it, expect } from "vitest";
import { buildPrdMarkdown } from "../generator.js";
import type { PrdData } from "../../types.js";

describe("buildPrdMarkdown", () => {
  it("should generate markdown with all sections", () => {
    const data: PrdData = {
      projectName: "TestProject",
      summary: "A test project",
      target: "Developers",
      pains: ["Pain 1"],
      solutions: ["Solution 1"],
      goals: ["Goal 1"],
      scenarios: ["Scenario 1"],
      mustFeatures: ["Feature 1"],
      optFeatures: ["Optional 1"],
      nonfunc: ["Performance"],
      stack: ["TypeScript"],
      scope: "MVP",
      outScope: "None",
      milestones: ["M1"],
      risks: ["Risk 1"],
    };

    const md = buildPrdMarkdown(data);
    expect(md).toContain("# TestProject — PRD");
    expect(md).toContain("A test project");
    expect(md).toContain("Pain 1");
    expect(md).toContain("Solution 1");
    expect(md).toContain("Feature 1");
    expect(md).toContain("TypeScript");
  });
});
