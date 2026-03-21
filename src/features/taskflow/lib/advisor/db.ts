import initSqlJs, { type Database } from "sql.js";
import fs from "node:fs/promises";
import path from "node:path";
import type { ConvLog, Decision, SessionType } from "../../types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  related_tasks TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conv_session ON conversation_logs(session_type, session_id);
CREATE INDEX IF NOT EXISTS idx_conv_created ON conversation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id);
`;

export class AdvisorDb {
  private db: Database;
  private dbPath: string;

  private constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  static async open(dbPath: string): Promise<AdvisorDb> {
    const SQL = await initSqlJs();

    let db: Database;
    try {
      const buffer = await fs.readFile(dbPath);
      db = new SQL.Database(buffer);
    } catch {
      db = new SQL.Database();
    }

    db.run(SCHEMA);
    return new AdvisorDb(db, dbPath);
  }

  insertLog(
    sessionType: SessionType,
    sessionId: string,
    role: "user" | "assistant",
    content: string
  ): void {
    this.db.run(
      "INSERT INTO conversation_logs (session_type, session_id, role, content) VALUES (?, ?, ?, ?)",
      [sessionType, sessionId, role, content]
    );
  }

  getLogsBySession(sessionId: string): ConvLog[] {
    return this.queryLogs(
      "SELECT * FROM conversation_logs WHERE session_id = ? ORDER BY id ASC",
      [sessionId]
    );
  }

  getLogsByType(sessionType: SessionType): ConvLog[] {
    return this.queryLogs(
      "SELECT * FROM conversation_logs WHERE session_type = ? ORDER BY id ASC",
      [sessionType]
    );
  }

  deleteExpiredLogs(days: number): number {
    this.db.run(
      "DELETE FROM conversation_logs WHERE created_at < datetime('now', ? || ' days')",
      [`-${days}`]
    );
    return this.db.getRowsModified();
  }

  insertDecision(
    sessionId: string,
    decision: string,
    reason: string,
    relatedTasks: string[]
  ): void {
    this.db.run(
      "INSERT INTO decisions (session_id, decision, reason, related_tasks) VALUES (?, ?, ?, ?)",
      [sessionId, decision, reason, JSON.stringify(relatedTasks)]
    );
  }

  getAllDecisions(): Decision[] {
    return this.queryDecisions(
      "SELECT * FROM decisions ORDER BY id DESC"
    );
  }

  getRecentDecisions(limit: number): Decision[] {
    return this.queryDecisions(
      "SELECT * FROM decisions ORDER BY id DESC LIMIT ?",
      [limit]
    );
  }

  getStats(): { logCount: number; decisionCount: number; dbSizeBytes: number } {
    const logRow = this.db.exec("SELECT COUNT(*) FROM conversation_logs");
    const decisionRow = this.db.exec("SELECT COUNT(*) FROM decisions");
    const data = this.db.export();

    return {
      logCount: Number(logRow[0]?.values[0]?.[0] ?? 0),
      decisionCount: Number(decisionRow[0]?.values[0]?.[0] ?? 0),
      dbSizeBytes: data.length,
    };
  }

  async persistToDisk(): Promise<void> {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    await fs.writeFile(this.dbPath, buffer);
  }

  persistToDiskAsync(): void {
    this.persistToDisk().catch((err) => {
      console.error("⚠️ advisor.db 디스크 저장 실패:", err);
    });
  }

  exec(sql: string): void {
    this.db.run(sql);
  }

  close(): void {
    this.db.close();
  }

  private queryLogs(sql: string, params: unknown[] = []): ConvLog[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);

    const results: ConvLog[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: Number(row.id),
        sessionType: row.session_type as SessionType,
        sessionId: String(row.session_id),
        role: row.role as "user" | "assistant",
        content: String(row.content),
        createdAt: String(row.created_at),
      });
    }
    stmt.free();
    return results;
  }

  private queryDecisions(sql: string, params: unknown[] = []): Decision[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);

    const results: Decision[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: Number(row.id),
        sessionId: String(row.session_id),
        decision: String(row.decision),
        reason: String(row.reason),
        relatedTasks: JSON.parse(String(row.related_tasks)),
        createdAt: String(row.created_at),
      });
    }
    stmt.free();
    return results;
  }
}
