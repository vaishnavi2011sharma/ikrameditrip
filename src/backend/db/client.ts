import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrations } from "./schema";
import { seed } from "../seed";

export type DB = DatabaseSync;

let shared: DB | null = null;

/** Open (and migrate) a database. Pass ":memory:" in tests. */
export function openDb(path: string): DB {
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj < 22 || (maj === 22 && min < 5)) {
    throw new Error(`Node.js 22.5 or newer is required (found ${process.versions.node}) — the database uses the built-in node:sqlite.`);
  }
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

export function migrate(db: DB): number[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  const done = new Set(
    (db.prepare("SELECT id FROM _migrations").all() as { id: number }[]).map((r) => r.id),
  );
  const applied: number[] = [];
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(m.sql);
      db.prepare("INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)").run(
        m.id,
        m.name,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
      applied.push(m.id);
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return applied;
}

/** Process-wide connection used by the running site. Path from DATABASE_PATH. */
export function getDb(): DB {
  if (!shared) {
    shared = openDb(process.env.DATABASE_PATH || "./data/ikra.db");
    // A brand-new database is filled once with the client-supplied hospitals/doctors/departments so the
    // site is never empty on first run. Skipped when any of those tables already has rows, or AUTO_SEED=false.
    if (process.env.AUTO_SEED !== "false") {
      const n = (t: string) => (shared!.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
      if (n("departments") + n("hospitals") + n("doctors") === 0) seed(shared);
    }
  }
  return shared;
}

/** Close the process-wide connection (releases the SQLite file and its -wal/-shm handles). Safe to call twice. */
export function closeDb(): void {
  if (!shared) return;
  const db = shared;
  shared = null;
  db.close();
}

export { tx } from "./tx";
