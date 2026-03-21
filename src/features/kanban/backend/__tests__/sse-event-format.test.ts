import { describe, it, expect } from "vitest";
import type { SseEvent, SseEventType } from "../sse-broadcaster";

describe("SseEvent format", () => {
  it("should have required fields for task events", () => {
    const event: SseEvent = {
      type: "created",
      id: "001",
      path: ".taskflow/tasks/task-001.md",
      ts: Date.now(),
    };

    expect(event.type).toBe("created");
    expect(event.id).toBe("001");
    expect(event.path).toContain("task-001.md");
    expect(typeof event.ts).toBe("number");
  });

  it("should allow optional id for index events", () => {
    const event: SseEvent = {
      type: "index",
      path: ".taskflow/index/TASKS.md",
      ts: Date.now(),
    };

    expect(event.type).toBe("index");
    expect(event.id).toBeUndefined();
  });

  it("should serialize to valid JSON", () => {
    const event: SseEvent = {
      type: "updated",
      id: "002",
      path: ".taskflow/tasks/task-002.md",
      ts: 1710979200000,
    };

    const json = JSON.stringify(event);
    const parsed = JSON.parse(json);

    expect(parsed.type).toBe("updated");
    expect(parsed.id).toBe("002");
    expect(parsed.ts).toBe(1710979200000);
  });

  it("should cover all event types", () => {
    const types: SseEventType[] = ["created", "updated", "deleted", "index"];
    expect(types).toHaveLength(4);

    for (const type of types) {
      const event: SseEvent = { type, path: "test", ts: Date.now() };
      expect(event.type).toBe(type);
    }
  });
});
