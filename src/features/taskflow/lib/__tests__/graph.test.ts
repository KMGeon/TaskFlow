import { describe, it, expect } from "vitest";
import { detectCycles, computeReadySet, scoreTask, recommend } from "../graph";
import type { Task } from "../../types";

const now = new Date().toISOString();
const old = new Date(Date.now() - 7 * 86_400_000).toISOString();

function t(overrides: Partial<Task>): Task {
  return {
    id: "001",
    title: "Task",
    status: "Todo",
    priority: 5,
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    description: "",
    ...overrides,
  };
}

// ── detectCycles ──

describe("detectCycles", () => {
  it("should return empty for acyclic graph", () => {
    const tasks = [
      t({ id: "1", dependencies: [] }),
      t({ id: "2", dependencies: ["1"] }),
      t({ id: "3", dependencies: ["2"] }),
    ];
    expect(detectCycles(tasks)).toHaveLength(0);
  });

  it("should detect simple cycle", () => {
    const tasks = [
      t({ id: "1", dependencies: ["2"] }),
      t({ id: "2", dependencies: ["1"] }),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("should detect longer cycle", () => {
    const tasks = [
      t({ id: "1", dependencies: ["3"] }),
      t({ id: "2", dependencies: ["1"] }),
      t({ id: "3", dependencies: ["2"] }),
    ];
    const cycles = detectCycles(tasks);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("should handle self-cycle", () => {
    const tasks = [t({ id: "1", dependencies: ["1"] })];
    const cycles = detectCycles(tasks);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("should handle no dependencies", () => {
    const tasks = [t({ id: "1" }), t({ id: "2" }), t({ id: "3" })];
    expect(detectCycles(tasks)).toHaveLength(0);
  });

  it("should ignore deps to non-existent tasks", () => {
    const tasks = [t({ id: "1", dependencies: ["999"] })];
    expect(detectCycles(tasks)).toHaveLength(0);
  });
});

// ── computeReadySet ──

describe("computeReadySet", () => {
  it("should mark tasks with no deps as ready", () => {
    const tasks = [
      t({ id: "1", status: "Todo", dependencies: [] }),
      t({ id: "2", status: "InProgress", dependencies: [] }),
    ];
    const { ready, blocked } = computeReadySet(tasks);
    expect(ready).toHaveLength(2);
    expect(blocked).toHaveLength(0);
  });

  it("should mark tasks with all deps Done as ready", () => {
    const tasks = [
      t({ id: "1", status: "Done", dependencies: [] }),
      t({ id: "2", status: "Todo", dependencies: ["1"] }),
    ];
    const { ready } = computeReadySet(tasks);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe("2");
  });

  it("should mark tasks with pending deps as blocked", () => {
    const tasks = [
      t({ id: "1", status: "Todo", dependencies: [] }),
      t({ id: "2", status: "Todo", dependencies: ["1"] }),
    ];
    const { ready, blocked } = computeReadySet(tasks);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe("1");
    expect(blocked).toHaveLength(1);
    expect(blocked[0].task.id).toBe("2");
    expect(blocked[0].pendingDeps).toEqual(["1"]);
  });

  it("should exclude Done tasks from results", () => {
    const tasks = [
      t({ id: "1", status: "Done" }),
      t({ id: "2", status: "Done" }),
    ];
    const { ready, blocked } = computeReadySet(tasks);
    expect(ready).toHaveLength(0);
    expect(blocked).toHaveLength(0);
  });

  it("should handle chain dependencies", () => {
    const tasks = [
      t({ id: "1", status: "Todo" }),
      t({ id: "2", status: "Todo", dependencies: ["1"] }),
      t({ id: "3", status: "Todo", dependencies: ["2"] }),
    ];
    const { ready, blocked } = computeReadySet(tasks);
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe("1");
    expect(blocked).toHaveLength(2);
  });
});

// ── scoreTask ──

describe("scoreTask", () => {
  it("should give higher score to higher priority", () => {
    const high = scoreTask(t({ priority: 9 }));
    const low = scoreTask(t({ priority: 2 }));
    expect(high).toBeGreaterThan(low);
  });

  it("should give bonus to InProgress tasks", () => {
    const ip = scoreTask(t({ status: "InProgress", priority: 5 }));
    const todo = scoreTask(t({ status: "Todo", priority: 5 }));
    expect(ip).toBeGreaterThan(todo);
  });

  it("should penalize Blocked tasks", () => {
    const blocked = scoreTask(t({ status: "Blocked", priority: 5 }));
    const todo = scoreTask(t({ status: "Todo", priority: 5 }));
    expect(blocked).toBeLessThan(todo);
  });

  it("should prefer recently updated tasks", () => {
    const recent = scoreTask(t({ updatedAt: now }));
    const stale = scoreTask(t({ updatedAt: old }));
    expect(recent).toBeGreaterThan(stale);
  });
});

// ── recommend ──

describe("recommend", () => {
  const tasks = [
    t({ id: "1", status: "Done", priority: 10 }),
    t({ id: "2", status: "Todo", priority: 8, dependencies: [] }),
    t({ id: "3", status: "Todo", priority: 3, dependencies: [] }),
    t({ id: "4", status: "Todo", priority: 6, dependencies: ["1"] }), // ready (dep done)
    t({ id: "5", status: "Todo", priority: 9, dependencies: ["2"] }), // blocked (dep not done)
    t({ id: "6", status: "InProgress", priority: 7, dependencies: [] }),
  ];

  it("should return top N ready tasks by score", () => {
    const recs = recommend(tasks, { limit: 3 });
    expect(recs).toHaveLength(3);
    // Should not include Done tasks or blocked tasks
    const ids = recs.map((r) => r.task.id);
    expect(ids).not.toContain("1"); // Done
    expect(ids).not.toContain("5"); // blocked
  });

  it("should default to 5 results", () => {
    const recs = recommend(tasks);
    expect(recs.length).toBeLessThanOrEqual(5);
  });

  it("should return all with --all", () => {
    const recs = recommend(tasks, { all: true });
    // Ready: 2 (no deps), 3 (no deps), 4 (dep 1 is Done), 6 (no deps) = 4
    expect(recs.length).toBe(4);
  });

  it("should include blocked with --include-blocked", () => {
    const recs = recommend(tasks, { includeBlocked: true, all: true });
    const ids = recs.map((r) => r.task.id);
    expect(ids).toContain("5"); // blocked but included
    const blockedRec = recs.find((r) => r.task.id === "5");
    expect(blockedRec!.pendingDeps).toEqual(["2"]);
  });

  it("should rank by score descending", () => {
    const recs = recommend(tasks, { all: true });
    for (let i = 0; i < recs.length - 1; i++) {
      expect(recs[i].score).toBeGreaterThanOrEqual(recs[i + 1].score);
    }
  });

  it("should handle empty task list", () => {
    const recs = recommend([], { limit: 5 });
    expect(recs).toHaveLength(0);
  });

  it("should handle all-done task list", () => {
    const done = [
      t({ id: "1", status: "Done" }),
      t({ id: "2", status: "Done" }),
    ];
    const recs = recommend(done);
    expect(recs).toHaveLength(0);
  });
});

// ── Performance ──

describe("performance", () => {
  it("should handle 2000 tasks under 200ms", () => {
    const tasks: Task[] = [];
    for (let i = 0; i < 2000; i++) {
      const id = String(i + 1).padStart(4, "0");
      const deps = i > 0 && i % 10 === 0 ? [String(i).padStart(4, "0")] : [];
      tasks.push(
        t({
          id,
          title: `Task ${id}`,
          priority: (i % 10) + 1,
          status: i < 100 ? "Done" : "Todo",
          dependencies: deps,
        }),
      );
    }

    const start = performance.now();
    const cycles = detectCycles(tasks);
    const recs = recommend(tasks, { limit: 10 });
    const elapsed = performance.now() - start;

    expect(cycles).toHaveLength(0);
    expect(recs.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });
});
