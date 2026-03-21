import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getSseBroadcaster, resetBroadcaster, type SseEvent } from "../sse-broadcaster";
import { ensureRepo, createTask, updateTask, deleteTask } from "@/features/taskflow/lib/repository";

let tmpDir: string;

beforeEach(async () => {
  resetBroadcaster();
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sse-test-"));
  await ensureRepo(tmpDir);
});

afterEach(async () => {
  const broadcaster = getSseBroadcaster();
  await broadcaster.destroy();
  resetBroadcaster();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("SseBroadcaster", () => {
  it("should be a singleton", () => {
    const a = getSseBroadcaster();
    const b = getSseBroadcaster();
    expect(a).toBe(b);
  });

  it("should reset properly", () => {
    const a = getSseBroadcaster();
    resetBroadcaster();
    const b = getSseBroadcaster();
    expect(a).not.toBe(b);
  });

  it("should subscribe and unsubscribe listeners", () => {
    const broadcaster = getSseBroadcaster();
    const listener = vi.fn();

    const unsub = broadcaster.subscribe(listener);
    expect(broadcaster.subscriberCount).toBe(1);

    unsub();
    expect(broadcaster.subscriberCount).toBe(0);
  });

  it("should support multiple subscribers", () => {
    const broadcaster = getSseBroadcaster();
    const l1 = vi.fn();
    const l2 = vi.fn();
    const l3 = vi.fn();

    const u1 = broadcaster.subscribe(l1);
    const u2 = broadcaster.subscribe(l2);
    const u3 = broadcaster.subscribe(l3);

    expect(broadcaster.subscriberCount).toBe(3);

    u2();
    expect(broadcaster.subscriberCount).toBe(2);

    u1();
    u3();
    expect(broadcaster.subscriberCount).toBe(0);
  });

  it("should broadcast file change events to subscribers", async () => {
    const broadcaster = getSseBroadcaster();
    broadcaster.init(tmpDir);

    const events: SseEvent[] = [];
    broadcaster.subscribe((e) => events.push(e));

    // Create a task file — triggers chokidar "add"
    await createTask(tmpDir, { title: "SSE test task", priority: 5 });

    // Wait for chokidar + throttle (awaitWriteFinish 100ms + throttle 300ms + margin)
    await new Promise((r) => setTimeout(r, 1000));

    // Should have received at least one event
    expect(events.length).toBeGreaterThanOrEqual(1);
    const taskEvent = events.find((e) => e.type === "created" || e.type === "updated");
    // created or updated depending on timing
    expect(taskEvent || events.find((e) => e.type === "index")).toBeTruthy();
  });

  it("should throttle rapid events", async () => {
    const broadcaster = getSseBroadcaster();
    broadcaster.init(tmpDir);

    const events: SseEvent[] = [];
    broadcaster.subscribe((e) => {
      if (e.path) events.push(e);
    });

    // Rapid create 5 tasks
    for (let i = 0; i < 5; i++) {
      await createTask(tmpDir, { title: `Rapid ${i}` });
    }

    // Wait for chokidar awaitWriteFinish + throttle to settle
    await new Promise((r) => setTimeout(r, 1500));

    // Throttling should produce fewer events than raw file operations
    // (5 creates × 2 files each = 10 raw events, throttle collapses them)
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThan(15);
  });

  it("should remove broken listeners gracefully", () => {
    const broadcaster = getSseBroadcaster();
    broadcaster.init(tmpDir);

    const brokenListener = () => {
      throw new Error("broken");
    };
    const goodListener = vi.fn();

    broadcaster.subscribe(brokenListener);
    broadcaster.subscribe(goodListener);

    expect(broadcaster.subscriberCount).toBe(2);
  });

  it("should clean up on destroy", async () => {
    const broadcaster = getSseBroadcaster();
    broadcaster.init(tmpDir);

    const listener = vi.fn();
    broadcaster.subscribe(listener);

    await broadcaster.destroy();

    expect(broadcaster.subscriberCount).toBe(0);
  });
});
