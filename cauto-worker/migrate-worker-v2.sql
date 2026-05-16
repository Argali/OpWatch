-- Worker v2 migration — run once in D1 Console
-- Safe to run multiple times (IF NOT EXISTS / OR IGNORE guards)

-- 1. Fix tenants.modules column: convert any legacy '[]' arrays to '{}'
--    New writes always store a JSON object {module: bool}
UPDATE tenants SET modules = '{}' WHERE modules = '[]' OR modules = 'null' OR modules IS NULL;

-- 2. bugs table (may already exist from initial schema)
CREATE TABLE IF NOT EXISTS bugs (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'new',
  reported_by TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. audit_logs table (may already exist from initial schema)
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  tenant_id     TEXT,
  module        TEXT NOT NULL,
  entity_table  TEXT,
  entity_id     TEXT,
  entity_label  TEXT,
  action        TEXT NOT NULL,
  field_changed TEXT,
  old_value     TEXT,
  new_value     TEXT,
  user_id       TEXT,
  user_email    TEXT,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_client    ON audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

-- 4. giorno column on routes — skip this line if you already ran migrate-add-giorno.sql
--    (D1 will show "duplicate column name: giorno" — that error is harmless, ignore it)
ALTER TABLE routes ADD COLUMN giorno TEXT DEFAULT NULL;
