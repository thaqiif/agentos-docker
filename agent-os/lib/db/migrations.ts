import type Database from "better-sqlite3";

interface Migration {
  id: number;
  name: string;
  up: (db: Database.Database) => void;
}

// All migrations in order - never modify existing ones, only add new
const migrations: Migration[] = [
  {
    id: 1,
    name: "add_group_path_to_sessions",
    // No-op: the sessions table was removed when terminals became
    // plain tmux sessions. Kept so migration ids stay stable.
    up: () => {},
  },
  {
    id: 2,
    name: "add_agent_type_to_sessions",
    // No-op: the sessions table was removed when terminals became
    // plain tmux sessions. Kept so migration ids stay stable.
    up: () => {},
  },
  {
    id: 3,
    name: "add_worktree_columns_to_sessions",
    // No-op: the sessions table was removed when terminals became
    // plain tmux sessions. Kept so migration ids stay stable.
    up: () => {},
  },
  {
    id: 4,
    name: "add_pr_tracking_to_sessions",
    // No-op: the sessions table was removed when terminals became
    // plain tmux sessions. Kept so migration ids stay stable.
    up: () => {},
  },
  {
    id: 5,
    name: "add_group_path_index",
    // No-op: the sessions table was removed when terminals became
    // plain tmux sessions. Kept so migration ids stay stable.
    up: () => {},
  },
  {
    id: 6,
    name: "add_orchestration_columns_to_sessions",
    // No-op: the sessions table was removed when terminals became
    // plain tmux sessions. Kept so migration ids stay stable.
    up: () => {},
  },
  {
    id: 7,
    name: "add_auto_approve_to_sessions",
    // No-op: the sessions table was removed when terminals became
    // plain tmux sessions. Kept so migration ids stay stable.
    up: () => {},
  },
  {
    id: 8,
    name: "add_dev_server_columns",
    up: (db) => {
      db.exec(
        `ALTER TABLE dev_servers ADD COLUMN type TEXT NOT NULL DEFAULT 'node'`
      );
      db.exec(
        `ALTER TABLE dev_servers ADD COLUMN name TEXT NOT NULL DEFAULT ''`
      );
      db.exec(
        `ALTER TABLE dev_servers ADD COLUMN command TEXT NOT NULL DEFAULT ''`
      );
      db.exec(`ALTER TABLE dev_servers ADD COLUMN pid INTEGER`);
      db.exec(
        `ALTER TABLE dev_servers ADD COLUMN working_directory TEXT NOT NULL DEFAULT ''`
      );
    },
  },
  {
    id: 9,
    name: "add_project_id_to_sessions",
    // No-op: the sessions table was removed when terminals became
    // plain tmux sessions. Kept so migration ids stay stable.
    up: () => {},
  },
  {
    id: 10,
    name: "add_project_id_to_dev_servers",
    up: (db) => {
      // Check if column exists first
      const cols = db.prepare(`PRAGMA table_info(dev_servers)`).all() as {
        name: string;
      }[];
      if (cols.some((c) => c.name === "project_id")) return;

      db.exec(
        `ALTER TABLE dev_servers ADD COLUMN project_id TEXT REFERENCES projects(id)`
      );
      // Migrate from session_id if it exists
      const hasSessionId = cols.some((c) => c.name === "session_id");
      if (hasSessionId) {
        db.exec(`
          UPDATE dev_servers
          SET project_id = (
            SELECT COALESCE(s.project_id, 'uncategorized')
            FROM sessions s
            WHERE s.id = dev_servers.session_id
          )
          WHERE project_id IS NULL
        `);
      }
      db.exec(
        `UPDATE dev_servers SET project_id = 'uncategorized' WHERE project_id IS NULL`
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_dev_servers_project ON dev_servers(project_id)`
      );
    },
  },
  {
    id: 11,
    name: "add_tmux_name_to_sessions",
    // No-op: the sessions table was removed when terminals became
    // plain tmux sessions. Kept so migration ids stay stable.
    up: () => {},
  },
  {
    id: 12,
    name: "add_initial_prompt_to_projects",
    up: (db) => {
      db.exec(`ALTER TABLE projects ADD COLUMN initial_prompt TEXT`);
    },
  },
  {
    id: 13,
    name: "add_project_repositories_table",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_repositories (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          is_primary INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_project_repositories_project ON project_repositories(project_id)`
      );
    },
  },
  {
    id: 14,
    name: "drop_session_tables",
    up: (db) => {
      // Terminals are tmux sessions now, and tmux is the only record of
      // them. Messages and tool calls belonged to the in-app chat view,
      // which went with them; groups were superseded by projects.
      db.exec(`DROP TABLE IF EXISTS tool_calls`);
      db.exec(`DROP TABLE IF EXISTS messages`);
      db.exec(`DROP TABLE IF EXISTS sessions`);
      db.exec(`DROP TABLE IF EXISTS groups`);
    },
  },
  {
    id: 15,
    name: "add_terminals_registry",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS terminals (
          name TEXT PRIMARY KEY,
          working_directory TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
  },
  {
    id: 16,
    name: "repair_mangled_terminal_names",
    up: (db) => {
      // tmux rewrites "." and ":" in session names, but renames used to be
      // recorded as typed. Any such row can never match a live session: it
      // shows as a permanently stopped terminal, and the real session turns
      // up alongside it as a second entry. Point them at the name tmux
      // would have chosen, dropping the row if that name is already taken —
      // that is the live entry, and it is the one worth keeping.
      const rows = db
        .prepare(`SELECT name FROM terminals`)
        .all() as { name: string }[];

      const taken = new Set(rows.map((r) => r.name));
      const rename = db.prepare(`UPDATE terminals SET name = ? WHERE name = ?`);
      const drop = db.prepare(`DELETE FROM terminals WHERE name = ?`);

      for (const { name } of rows) {
        const fixed = name.replace(/[.:]/g, "_");
        if (fixed === name) continue;

        if (taken.has(fixed)) {
          drop.run(name);
        } else {
          rename.run(fixed, name);
          taken.add(fixed);
        }
        taken.delete(name);
      }
    },
  },
];

export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Get already applied migrations
  const applied = new Set(
    (db.prepare(`SELECT id FROM _migrations`).all() as { id: number }[]).map(
      (r) => r.id
    )
  );

  // Use INSERT OR IGNORE to handle concurrent workers
  const insertMigration = db.prepare(
    `INSERT OR IGNORE INTO _migrations (id, name) VALUES (?, ?)`
  );

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    try {
      migration.up(db);
      const result = insertMigration.run(migration.id, migration.name);
      if (result.changes > 0) {
        console.log(`Migration ${migration.id}: ${migration.name} applied`);
      } else {
        console.log(
          `Migration ${migration.id}: ${migration.name} skipped (concurrent apply)`
        );
      }
    } catch (error) {
      // Some migrations may fail if columns already exist (from old system or concurrent worker)
      // Try to record as applied anyway to prevent re-running
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (
        errorMsg.includes("duplicate column") ||
        errorMsg.includes("already exists")
      ) {
        insertMigration.run(migration.id, migration.name);
        console.log(
          `Migration ${migration.id}: ${migration.name} skipped (already applied)`
        );
      } else {
        console.error(
          `Migration ${migration.id}: ${migration.name} failed:`,
          error
        );
        throw error;
      }
    }
  }
}
