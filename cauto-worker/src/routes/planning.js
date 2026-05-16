/**
 * Planning routes — D1-backed (replaces Express + JSON file store)
 *
 * GET  /api/planning/vehicles              — vehicles available for planning
 * GET  /api/planning/vehicle-availability  — workshop conflicts per plate
 * GET  /api/planning/operators             — operators for planning
 * PUT  /api/planning/operators/:id         — update operator
 * DELETE /api/planning/operators/:id       — soft-delete operator
 * GET  /api/planning/events                — events for a week (?week_key=YYYY-Www)
 * PUT  /api/planning/events                — replace all events for a week
 * GET  /api/planning/stream                — SSE stub (use polling instead)
 * GET  /api/planning/stream/count          — SSE connection count (always 0)
 */

import { Hono }        from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const planning = new Hono();
planning.use("*", requireAuth, rbac("planning", "view"));

// ── Mock vehicles (fallback when D1 vehicles table is empty) ──────────────────
const MOCK_VEHICLES = [
  { id: "v1", plate: "FE-123-AA", name: "Camion 01",  status: "active"    },
  { id: "v2", plate: "FE-456-BB", name: "Camion 02",  status: "active"    },
  { id: "v3", plate: "FE-789-CC", name: "Furgone 01", status: "active"    },
  { id: "v4", plate: "FE-012-DD", name: "Camion 03",  status: "workshop"  },
];

// ── GET /vehicles ─────────────────────────────────────────────────────────────
planning.get("/vehicles", async (c) => {
  const { results } = await c.env.DB
    .prepare("SELECT id, external_id, license_plate, status FROM vehicles WHERE status != 'RETIRED' ORDER BY license_plate")
    .all();

  const data = results.length
    ? results.map(v => ({
        id:     v.id,
        plate:  v.license_plate,
        name:   v.external_id,
        status: (v.status ?? "active").toLowerCase(),
      }))
    : MOCK_VEHICLES;

  return c.json({ ok: true, data });
});

// ── GET /vehicle-availability?weekKey=YYYY-Www ────────────────────────────────
planning.get("/vehicle-availability", async (c) => {
  const user = c.get("user");
  const { results: orders } = await c.env.DB
    .prepare("SELECT plate, tipo, status FROM work_orders WHERE tenant_id = ? AND status != 'done'")
    .bind(user.tenant_id)
    .all();

  const availability = {};
  for (const order of orders) {
    if (!order.plate) continue;
    if (!availability[order.plate])
      availability[order.plate] = { workshopBlocks: [], gpsStatus: null };
    availability[order.plate].workshopBlocks.push({
      reason: order.tipo,
      status: order.status,
    });
  }
  return c.json({ ok: true, data: availability });
});

// ── GET /operators ────────────────────────────────────────────────────────────
planning.get("/operators", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare(`
      SELECT id, external_id, name, email, role, status,
             license_number, license_expiry, license_categories
      FROM operators
      WHERE organization_id = ? AND status = 'ACTIVE'
      ORDER BY name
    `)
    .bind(user.tenant_id)
    .all();

  return c.json({
    ok: true,
    data: results.map(op => ({
      ...op,
      license_categories: JSON.parse(op.license_categories ?? "[]"),
      plannerEnabled: true,
    })),
  });
});

// ── PUT /operators/:id ────────────────────────────────────────────────────────
planning.patch("/operators/:id", rbac("planning", "edit"), async (c) => {
  const user = c.get("user");
  const id   = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const ALLOWED = ["name", "email", "role", "status", "license_number", "license_expiry"];
  const fields  = Object.keys(body).filter(k => ALLOWED.includes(k));
  if (!fields.length) return c.json({ ok: false, error: "Nessun campo valido" }, 400);

  const set    = fields.map(k => `${k} = ?`).join(", ");
  const values = fields.map(k => body[k]);

  const { meta } = await c.env.DB
    .prepare(`UPDATE operators SET ${set} WHERE id = ? AND organization_id = ?`)
    .bind(...values, id, user.tenant_id)
    .run();

  if (!meta.changes) return c.json({ ok: false, error: "Operatore non trovato" }, 404);
  return c.json({ ok: true });
});

// ── DELETE /operators/:id — soft delete ───────────────────────────────────────
planning.delete("/operators/:id", rbac("planning", "edit"), async (c) => {
  const user = c.get("user");
  const id   = c.req.param("id");
  await c.env.DB
    .prepare("UPDATE operators SET status = 'INACTIVE' WHERE id = ? AND organization_id = ?")
    .bind(id, user.tenant_id)
    .run();
  return c.json({ ok: true });
});

// ── GET /events?week_key=YYYY-Www ─────────────────────────────────────────────
planning.get("/events", async (c) => {
  const user     = c.get("user");
  const week_key = c.req.query("week_key");

  const { results } = await c.env.DB
    .prepare(
      week_key
        ? "SELECT * FROM planning_events WHERE tenant_id = ? AND week_key = ? ORDER BY day_index, start_slot"
        : "SELECT * FROM planning_events WHERE tenant_id = ? ORDER BY week_key, day_index, start_slot"
    )
    .bind(...(week_key ? [user.tenant_id, week_key] : [user.tenant_id]))
    .all();

  return c.json({
    ok: true,
    data: results.map(e => ({
      ...e,
      operators: JSON.parse(e.operators_json ?? "[]"),
      trucks:    JSON.parse(e.trucks_json    ?? "[]"),
      photos:    JSON.parse(e.photos_json    ?? "[]"),
    })),
    version: Date.now(),
  });
});

// ── PUT /events — replace week events ────────────────────────────────────────
planning.patch("/events", rbac("planning", "edit"), async (c) => {
  const user   = c.get("user");
  const body   = await c.req.json().catch(() => ({}));
  const events = body.events;

  if (!Array.isArray(events))
    return c.json({ ok: false, error: "events deve essere un array" }, 400);

  const week_key = events.length ? events[0].week_key : body.week_key;
  if (!week_key)
    return c.json({ ok: false, error: "week_key richiesto" }, 400);

  const stmts = [
    // 1. Delete existing events for this tenant+week
    c.env.DB
      .prepare("DELETE FROM planning_events WHERE tenant_id = ? AND week_key = ?")
      .bind(user.tenant_id, week_key),
  ];

  // 2. Insert each event
  for (const ev of events) {
    const id = ev.id ?? crypto.randomUUID();
    stmts.push(
      c.env.DB.prepare(`
        INSERT INTO planning_events
          (id, tenant_id, title, week_key, day_index, start_slot, end_slot, cat, status,
           operators_json, trucks_json, client_id, comune, recurrence_group_id, note,
           odometer, actual_cost, photos_json, auto_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        id,
        user.tenant_id,
        ev.title           ?? "",
        week_key,
        ev.day_index       ?? 0,
        ev.start_slot      ?? 0,
        ev.end_slot        ?? 1,
        ev.cat             ?? "altro",
        ev.status          ?? "pianificato",
        JSON.stringify(ev.operators ?? []),
        JSON.stringify(ev.trucks    ?? []),
        ev.client_id            ?? null,
        ev.comune               ?? "",
        ev.recurrence_group_id  ?? null,
        ev.note                 ?? "",
        ev.odometer             ?? "",
        ev.actual_cost          ?? null,
        JSON.stringify(ev.photos ?? []),
        ev.auto_status ?? 1,
      )
    );
  }

  await c.env.DB.batch(stmts);

  return c.json({ ok: true, data: { version: Date.now() } });
});

// ── SSE stream — not available on stateless Workers ───────────────────────────
// Use periodic polling on GET /events instead.
planning.get("/stream", (c) => {
  return c.json(
    { ok: false, error: "SSE non disponibile su Worker stateless. Usa il polling su GET /events." },
    501
  );
});

planning.get("/stream/count", (c) => {
  return c.json({ ok: true, data: { connections: 0 } });
});

export default planning;
