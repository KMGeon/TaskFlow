import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AdvisorDb } from "./db.js";

let tmpDir: string;
let db: AdvisorDb;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "advisor-db-"));
  db = await AdvisorDb.open(path.join(tmpDir, "advisor.db"));
});

afterEach(async () => {
  db.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("AdvisorDb", () => {
  describe("conversation_logs", () => {
    it("should insert and query conversation logs", async () => {
      db.insertLog("brainstorm", "session-1", "user", "hello");
      db.insertLog("brainstorm", "session-1", "assistant", "hi there");

      const logs = db.getLogsBySession("session-1");
      expect(logs).toHaveLength(2);
      expect(logs[0].role).toBe("user");
      expect(logs[0].content).toBe("hello");
      expect(logs[1].role).toBe("assistant");
    });

    it("should filter logs by session type", () => {
      db.insertLog("brainstorm", "s1", "user", "msg1");
      db.insertLog("ask", "s2", "user", "msg2");

      const brainstormLogs = db.getLogsByType("brainstorm");
      expect(brainstormLogs).toHaveLength(1);
      expect(brainstormLogs[0].sessionId).toBe("s1");
    });

    it("should delete logs older than N days", () => {
      db.insertLog("ask", "old", "user", "old message");
      db.exec(
        "UPDATE conversation_logs SET created_at = datetime('now', '-10 days') WHERE session_id = 'old'"
      );
      db.insertLog("ask", "new", "user", "new message");

      const deleted = db.deleteExpiredLogs(7);
      expect(deleted).toBe(1);

      const remaining = db.getLogsByType("ask");
      expect(remaining).toHaveLength(1);
      expect(remaining[0].sessionId).toBe("new");
    });
  });

  describe("decisions", () => {
    it("should insert and query decisions", () => {
      db.insertDecision("session-1", "Use sql.js", "No native deps", ["1", "2"]);

      const decisions = db.getAllDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0].decision).toBe("Use sql.js");
      expect(decisions[0].relatedTasks).toEqual(["1", "2"]);
    });

    it("should get recent decisions with limit", () => {
      db.insertDecision("s1", "Decision 1", "Reason 1", []);
      db.insertDecision("s2", "Decision 2", "Reason 2", []);
      db.insertDecision("s3", "Decision 3", "Reason 3", []);

      const recent = db.getRecentDecisions(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].decision).toBe("Decision 3");
    });
  });

  describe("persistence", () => {
    it("should persist to disk and reload", async () => {
      const dbPath = path.join(tmpDir, "persist-test.db");
      const db1 = await AdvisorDb.open(dbPath);
      db1.insertDecision("s1", "Persisted decision", "reason", []);
      await db1.persistToDisk();
      db1.close();

      const db2 = await AdvisorDb.open(dbPath);
      const decisions = db2.getAllDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0].decision).toBe("Persisted decision");
      db2.close();
    });
  });

  describe("stats", () => {
    it("should return correct stats", () => {
      db.insertLog("ask", "s1", "user", "q1");
      db.insertLog("ask", "s1", "assistant", "a1");
      db.insertDecision("s1", "d1", "r1", []);

      const stats = db.getStats();
      expect(stats.logCount).toBe(2);
      expect(stats.decisionCount).toBe(1);
    });
  });
});
