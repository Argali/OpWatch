/**
 * Superadmin routes — tenant management + analytics (superadmin role only)
 * Also exports auditLogs Hono app for /api/audit-logs
 *
 * GET    /api/superadmin/tenants
 * PATCH  /api/superadmin/tenants/:id/modules
 * PATCH  /api/superadmin/tenants/:id/active
 * GET    /api/superadmin/analytics
 *
 * GET    /api/audit-logs?module=&limit=&entity_id=
 */

import { Hono }        from "hono";
import { requireAuth } from "../middleware/auth.js";

const ALL_MODULES = [
  "gps","navigation","foto_timbrata","cdr","zone","punti",
  "percorsi","pdf_export","workshop","segnalazioni","fuel",
  "suppliers","costs","planning","territorio","admin",
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function requireSuperadmin(c, next) {
  const user = c.get("user");
  if (!user) return c.json({ ok: false, error: "Non autenticato" }, 401);
  if (user.role !== "superadmin")
    return c.json({ ok: false, error: "Accesso riservato al superadmin" }, 403);
  return next();
}

// Parse modules column — stored as JSON object, may be legacy '[]' array
function parseMods(raw) {
  try {
    const v = JSON.parse(raw ?? "{}");
    return Array.isArray(v) ? {} : v;
  } catch {
    return {};
  }
}

// Shape a raw tenant DB row for the API response
function shapeTenant(t, userCount) {
  return {
    id:          t.id,
    name:        t.name,
    plan:        "standard",
    active:      t.active === 1 || t.active === true,
    modules:     parseMods(t.modules),
    user_count:  userCount ?? 0,
    last_active: t.updated_at ?? t.created_at,
    created_at:  t.created_at,
  };
}

// ── Superadmin router ─────────────────────────────────────────────────────────
const superadmin = new Hono();
superadmin.use("*", requireAuth, requireSuperadmin);

// GET /tenants — list all tenants with per-tenant user counts
superadmin.get("/tenants", async (c) => {
  const { results: tenants } = await c.env.DB
    .prepare("SELECT * FROM tenants ORDER BY name")
    .all();

  // One aggregation query for all user counts
  const { results: counts } = await c.env.DB
    .prepare("SELECT tenant_id, COUNT(*) AS cnt FROM users WHERE active = 1 GROUP BY tenant_id")
    .all();

  const countMap = Object.fromEntries(counts.map(r => [r.tenant_id, r.cnt]));

  return c.json({ ok: true, data: tenants.map(t => shapeTenant(t, countMap[t.id] ?? 0)) });
});

// PATCH /tenants/:id/modules — merge-update the modules object
superadmin.patch("/tenants/:id/modules", async (c) => {
  const id   = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  if (!body.modules || typeof body.modules !== "object" || Array.isArray(body.modules))
    return c.json({ ok: false, error: "Campo 'modules' deve essere un oggetto" }, 400);

  const invalid = Object.keys(body.modules).filter(k => !ALL_MODULES.includes(k));
  if (invalid.length)
    return c.json({ ok: false, error: `Moduli non validi: ${invalid.join(", ")}` }, 400);

  const row = await c.env.DB
    .prepare("SELECT modules FROM tenants WHERE id = ?")
    .bind(id).first();
  if (!row) return c.json({ ok: false, error: "Tenant non trovato" }, 404);

  const merged = { ...parseMods(row.modules), ...body.modules };
  await c.env.DB
    .prepare("UPDATE tenants SET modules = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(JSON.stringify(merged), id)
    .run();

  return c.json({ ok: true, data: { id, modules: merged } });
});

// PATCH /tenants/:id/active — suspend or reactivate a tenant
superadmin.patch("/tenants/:id/active", async (c) => {
  const id   = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.active !== "boolean")
    return c.json({ ok: false, error: "Campo 'active' deve essere boolean" }, 400);

  const { meta } = await c.env.DB
    .prepare("UPDATE tenants SET active = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(body.active ? 1 : 0, id)
    .run();
  if (!meta.changes) return c.json({ ok: false, error: "Tenant non trovato" }, 404);

  return c.json({ ok: true, data: { id, active: body.active } });
});

// GET /analytics — aggregate counts from D1
superadmin.get("/analytics", async (c) => {
  const [tenantRows, userRows, modRows] = await Promise.all([
    c.env.DB.prepare("SELECT id, name, active, modules, updated_at FROM tenants").all(),
    c.env.DB.prepare("SELECT tenant_id, active FROM users").all(),
    c.env.DB.prepare("SELECT modules, active FROM tenants WHERE active = 1").all(),
  ]);

  const tenants       = tenantRows.results;
  const users         = userRows.results;
  const activeTenants = tenants.filter(t => t.active === 1 || t.active === true);
  const now           = Date.now();

  const inactiveTenants = activeTenants.filter(t => {
    const d = new Date(t.updated_at ?? 0).getTime();
    return now - d > SEVEN_DAYS_MS;
  });

  const activeUsers = users.filter(u => u.active === 1 && u.role !== "superadmin");

  // Module adoption across active tenants
  const moduleAdoption = ALL_MODULES.map(mod => {
    const count = modRows.results.filter(t => {
      const m = parseMods(t.modules);
      return m[mod] === true;
    }).length;
    const total = activeTenants.length;
    return { module: mod, count, total, pct: total ? Math.round(count / total * 100) : 0 };
  });

  const tenantStats = activeTenants.map(t => {
    const mods    = parseMods(t.modules);
    const userCnt = users.filter(u => u.tenant_id === t.id && u.active === 1).length;
    const lastTs  = new Date(t.updated_at ?? 0).getTime();
    return {
      id:              t.id,
      name:            t.name,
      plan:            "standard",
      last_active:     t.updated_at,
      inactive:        now - lastTs > SEVEN_DAYS_MS,
      user_count:      userCnt,
      modules_enabled: Object.values(mods).filter(Boolean).length,
    };
  });

  return c.json({
    ok: true,
    data: {
      summary: {
        total_tenants:    tenants.length,
        active_tenants:   activeTenants.length,
        inactive_tenants: inactiveTenants.length,
        total_users:      activeUsers.length,
      },
      module_adoption: moduleAdoption,
      tenant_stats:    tenantStats,
      inactive_alerts: inactiveTenants.map(t => ({
        id:            t.id,
        name:          t.name,
        last_active:   t.updated_at,
        days_inactive: Math.floor((now - new Date(t.updated_at ?? 0).getTime()) / 86400000),
      })),
    },
  });
});

// ── Audit-logs router (mounted at /api/audit-logs) ────────────────────────────
export const auditLogs = new Hono();
auditLogs.use("*", requireAuth);

auditLogs.get("/", async (c) => {
  const user   = c.get("user");
  const module = c.req.query("module") || null;
  const limit  = Math.min(parseInt(c.req.query("limit") ?? "300", 10), 1000);
  const entity = c.req.query("entity_id") || null;

  let sql    = "SELECT * FROM audit_logs WHERE client_id = ?";
  const args = [user.tenant_id];

  if (module) { sql += " AND module = ?";    args.push(module); }
  if (entity) { sql += " AND entity_id = ?"; args.push(entity); }
  sql += " ORDER BY timestamp DESC LIMIT ?";
  args.push(limit);

  const { results } = await c.env.DB.prepare(sql).bind(...args).all();
  return c.json({ ok: true, data: results });
});

export default superadmin;
