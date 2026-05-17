-- ============================================================
-- Migration 0010 — OpsFinance: Budget Module
-- Run in D1 Console (opsonata-db), one statement at a time.
-- Safe to re-run: duplicate-column / table-exists errors can
-- be ignored if a statement already ran successfully.
--
-- Tables created:
--   budget_departments, budget_sectors, budgets,
--   budget_lines, budget_forecasts, budget_actuals
-- Alterations:
--   vehicles.sector_id, planning_events.sector_id
-- ============================================================

-- 1. Org chart: departments (top level)
CREATE TABLE budget_departments (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  name            TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, name)
);

-- 2. Org chart: sectors (child of department)
CREATE TABLE budget_sectors (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  department_id   TEXT NOT NULL REFERENCES budget_departments(id),
  name            TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, department_id, name)
);

-- 3. Budgets (annual or multi-annual, per sector)
CREATE TABLE budgets (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  sector_id       TEXT NOT NULL REFERENCES budget_sectors(id),
  label           TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'annual',
  year_start      INTEGER NOT NULL,
  year_end        INTEGER NOT NULL,
  total_amount    REAL NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Budget lines (monthly breakdown within a budget)
CREATE TABLE budget_lines (
  id              TEXT PRIMARY KEY,
  budget_id       TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL,
  amount          REAL NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(budget_id, year, month)
);

-- 5. Forecast revisions
CREATE TABLE budget_forecasts (
  id              TEXT PRIMARY KEY,
  budget_id       TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL,
  revised_amount  REAL NOT NULL,
  note            TEXT NOT NULL DEFAULT '',
  revised_by      TEXT,
  revised_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Actuals (written nightly by the cron Worker)
CREATE TABLE budget_actuals (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenants(id),
  sector_id           TEXT NOT NULL REFERENCES budget_sectors(id),
  year                INTEGER NOT NULL,
  month               INTEGER NOT NULL,
  fuel_total          REAL NOT NULL DEFAULT 0,
  maintenance_total   REAL NOT NULL DEFAULT 0,
  operations_total    REAL NOT NULL DEFAULT 0,
  total               REAL GENERATED ALWAYS AS (
                        fuel_total + maintenance_total + operations_total
                      ) STORED,
  computed_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, sector_id, year, month)
);

-- 7. Add sector_id to vehicles
ALTER TABLE vehicles
  ADD COLUMN sector_id TEXT REFERENCES budget_sectors(id);

-- 8. Add sector_id to planning_events
ALTER TABLE planning_events
  ADD COLUMN sector_id TEXT REFERENCES budget_sectors(id);

-- Indexes
CREATE INDEX idx_budget_departments_tenant ON budget_departments(tenant_id);
CREATE INDEX idx_budget_sectors_tenant     ON budget_sectors(tenant_id);
CREATE INDEX idx_budget_sectors_dept       ON budget_sectors(department_id);
CREATE INDEX idx_budgets_tenant_sector     ON budgets(tenant_id, sector_id);
CREATE INDEX idx_budget_lines_budget       ON budget_lines(budget_id);
CREATE INDEX idx_budget_lines_period       ON budget_lines(tenant_id, year, month);
CREATE INDEX idx_budget_forecasts_budget   ON budget_forecasts(budget_id);
CREATE INDEX idx_budget_forecasts_period   ON budget_forecasts(tenant_id, year, month);
CREATE INDEX idx_budget_actuals_sector     ON budget_actuals(tenant_id, sector_id);
CREATE INDEX idx_budget_actuals_period     ON budget_actuals(tenant_id, year, month);
CREATE INDEX idx_vehicles_sector           ON vehicles(sector_id);
CREATE INDEX idx_planning_events_sector    ON planning_events(sector_id);
