-- =============================================================================
-- OpWatch / opsonata-db — Initial Schema Migration
-- Generated: 2026-05-13
-- Target: Cloudflare D1 (SQLite-compatible)
-- =============================================================================

-- ── TENANTS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  modules     TEXT NOT NULL DEFAULT '[]',  -- JSON array of enabled module keys
  ponti       TEXT NOT NULL DEFAULT '[]',  -- JSON array of workshop bay names
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── USERS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role          TEXT NOT NULL,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  active        INTEGER NOT NULL DEFAULT 1,
  auth_provider TEXT NOT NULL DEFAULT 'local',  -- 'local' | 'azure'
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- ── PERMISSIONS (RBAC matrix) ─────────────────────────────────────────────────
-- One row per tenant × role × module. Level: none | view | edit | full
CREATE TABLE IF NOT EXISTS permissions (
  id        TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  role      TEXT NOT NULL,
  module    TEXT NOT NULL,
  level     TEXT NOT NULL DEFAULT 'none',
  UNIQUE(tenant_id, role, module)
);
CREATE INDEX IF NOT EXISTS idx_permissions_tenant_role ON permissions(tenant_id, role);

-- ── VEHICLES (canonical) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id              TEXT PRIMARY KEY,
  external_id     TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES tenants(id),
  license_plate   TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | INACTIVE | WORKSHOP
  vehicle_type    TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT 'unknown',
  ingested_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_vehicles_org ON vehicles(organization_id);

-- ── OPERATORS / DRIVERS (canonical) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operators (
  id                  TEXT PRIMARY KEY,
  external_id         TEXT NOT NULL,
  organization_id     TEXT NOT NULL REFERENCES tenants(id),
  name                TEXT NOT NULL,
  email               TEXT,
  role                TEXT NOT NULL DEFAULT 'driver',
  status              TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | INACTIVE
  license_number      TEXT,
  license_expiry      TEXT,         -- ISO date YYYY-MM-DD
  license_categories  TEXT NOT NULL DEFAULT '[]',  -- JSON array e.g. ["C","CE"]
  source              TEXT NOT NULL DEFAULT 'unknown',
  ingested_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_operators_org ON operators(organization_id);

-- ── MAINTENANCE EVENTS (canonical) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_events (
  id              TEXT PRIMARY KEY,
  external_id     TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES tenants(id),
  vehicle_id      TEXT,
  vehicle_ext_id  TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  date            TEXT NOT NULL,
  cost_eur        REAL,
  mileage_km      REAL,
  status          TEXT NOT NULL DEFAULT 'CLOSED',  -- OPEN | IN_PROGRESS | CLOSED
  source          TEXT NOT NULL DEFAULT 'unknown',
  ingested_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_maintenance_org     ON maintenance_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_events(vehicle_ext_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date    ON maintenance_events(date);

-- ── WORK ORDERS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  vehicle     TEXT NOT NULL,
  plate       TEXT NOT NULL DEFAULT '',
  tipo        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'aperto',   -- aperto | in_lavorazione | chiuso
  priority    TEXT NOT NULL DEFAULT 'normale',  -- bassa | normale | alta | urgente
  ponte       TEXT,
  cost_eur    REAL,
  mileage_km  INTEGER,
  opened_at   TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_work_orders_tenant ON work_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);

-- ── WORKSHOP PLANNING (ponte slot assignments) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS workshop_planning (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  order_id   TEXT NOT NULL,
  ponte      TEXT NOT NULL,
  date       TEXT NOT NULL,   -- YYYY-MM-DD
  start_hour INTEGER NOT NULL,
  duration   INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workshop_planning_tenant_date ON workshop_planning(tenant_id, date);

-- ── FUEL ENTRIES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_entries (
  id        TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  date      TEXT NOT NULL,
  vehicle   TEXT NOT NULL,
  liters    REAL NOT NULL,
  cost_eur  REAL NOT NULL,
  km        INTEGER,
  station   TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fuel_entries_tenant ON fuel_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuel_entries_date   ON fuel_entries(date);

-- ── MONTHLY COSTS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_costs (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  month       TEXT NOT NULL,  -- YYYY-MM
  fuel        REAL NOT NULL DEFAULT 0,
  maintenance REAL NOT NULL DEFAULT 0,
  other       REAL NOT NULL DEFAULT 0,
  total       REAL NOT NULL DEFAULT 0,
  UNIQUE(tenant_id, month)
);
CREATE INDEX IF NOT EXISTS idx_monthly_costs_tenant ON monthly_costs(tenant_id);

-- ── SUPPLIERS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  contact    TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  notes      TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- ── SEGNALAZIONI (vehicle issues) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS segnalazioni (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  tipo        TEXT NOT NULL,  -- guasto | incidente | manutenzione
  vehicle     TEXT NOT NULL,
  plate       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'aperta',  -- aperta | in_lavorazione | chiusa
  ponte       TEXT,
  reported_by TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_segnalazioni_tenant ON segnalazioni(tenant_id);
CREATE INDEX IF NOT EXISTS idx_segnalazioni_status ON segnalazioni(status);

-- ── SEGNALAZIONI TERRITORIO ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS segnalazioni_territorio (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  tipo        TEXT NOT NULL,  -- mancata_raccolta | abbandono | da_pulire | altro
  lat         REAL,
  lng         REAL,
  address     TEXT NOT NULL DEFAULT '',
  comune      TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'aperta',
  photos      TEXT NOT NULL DEFAULT '[]',  -- JSON array
  reported_by TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_segnterr_tenant ON segnalazioni_territorio(tenant_id);
CREATE INDEX IF NOT EXISTS idx_segnterr_status ON segnalazioni_territorio(status);

-- ── SEGNALAZIONI TERRITORIO — INTERVENTIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS segnalazioni_territorio_interventions (
  id               TEXT PRIMARY KEY,
  segnalazione_id  TEXT NOT NULL REFERENCES segnalazioni_territorio(id) ON DELETE CASCADE,
  description      TEXT NOT NULL DEFAULT '',
  operator_id      TEXT,
  date             TEXT NOT NULL DEFAULT (datetime('now')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_interventions_seg ON segnalazioni_territorio_interventions(segnalazione_id);

-- ── PLANNING EVENTS ───────────────────────────────────────────────────────────
-- operators and trucks stored as JSON arrays (nested objects)
CREATE TABLE IF NOT EXISTS planning_events (
  id                      TEXT PRIMARY KEY,
  tenant_id               TEXT NOT NULL REFERENCES tenants(id),
  title                   TEXT NOT NULL,
  week_key                TEXT NOT NULL,      -- YYYY-Www
  day_index               INTEGER NOT NULL,   -- 0–6
  start_slot              INTEGER NOT NULL,   -- 0–47 (30-min slots)
  end_slot                INTEGER NOT NULL,   -- 1–48
  cat                     TEXT NOT NULL DEFAULT 'altro',
  status                  TEXT NOT NULL DEFAULT 'pianificato',
  operators_json          TEXT NOT NULL DEFAULT '[]',
  trucks_json             TEXT NOT NULL DEFAULT '[]',
  client_id               TEXT,
  comune                  TEXT NOT NULL DEFAULT '',
  recurrence_group_id     TEXT,
  note                    TEXT NOT NULL DEFAULT '',
  odometer                TEXT NOT NULL DEFAULT '',
  actual_cost             REAL,
  photos_json             TEXT NOT NULL DEFAULT '[]',
  completed_at            TEXT,
  auto_status             INTEGER NOT NULL DEFAULT 1,
  last_auto_transition_at TEXT,
  auto_transition_reason  TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_planning_tenant_week ON planning_events(tenant_id, week_key);
CREATE INDEX IF NOT EXISTS idx_planning_status      ON planning_events(status);

-- ── GPS ROUTES (percorsi) ─────────────────────────────────────────────────────
-- Migrates data currently stored in browser localStorage
CREATE TABLE IF NOT EXISTS routes (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  name           TEXT NOT NULL,
  color          TEXT NOT NULL DEFAULT '#4ade80',
  opacity        REAL NOT NULL DEFAULT 0.85,
  comune         TEXT NOT NULL DEFAULT '',
  materiale      TEXT NOT NULL DEFAULT '',
  sector         TEXT NOT NULL DEFAULT '',
  waypoints_json TEXT NOT NULL DEFAULT '[]',  -- JSON [{lat, lng}]
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_routes_tenant ON routes(tenant_id);

-- ── GPS ZONES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'circle',  -- circle | square | triangle | parallelogram
  comune        TEXT NOT NULL DEFAULT '',
  materiale     TEXT NOT NULL DEFAULT '',
  sector        TEXT NOT NULL DEFAULT '',
  fill_color    TEXT NOT NULL DEFAULT '#60a5fa',
  fill_opacity  REAL NOT NULL DEFAULT 0.3,
  border_color  TEXT NOT NULL DEFAULT '#3a7bd5',
  vertices_json TEXT NOT NULL DEFAULT '[]',  -- JSON [{lat, lng}]
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_zones_tenant ON zones(tenant_id);

-- ── GPS POINTS OF INTEREST (punti) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS punti (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  nome       TEXT NOT NULL,
  comune     TEXT NOT NULL DEFAULT '',
  materiale  TEXT NOT NULL DEFAULT '',
  sector     TEXT NOT NULL DEFAULT '',
  color      TEXT NOT NULL DEFAULT '#f87171',
  lat        REAL,
  lng        REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_punti_tenant ON punti(tenant_id);

-- ── AUDIT LOGS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  tenant_id     TEXT,
  module        TEXT NOT NULL,
  entity_table  TEXT,
  entity_id     TEXT,
  entity_label  TEXT,
  action        TEXT NOT NULL,   -- CREATE | UPDATE | DELETE
  field_changed TEXT,
  old_value     TEXT,
  new_value     TEXT,
  user_id       TEXT,
  user_email    TEXT,
  timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_client    ON audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

-- ── BUGS / FEEDBACK ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bugs (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'new',  -- new | acknowledged | resolved
  reported_by TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
