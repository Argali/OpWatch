import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const workshop = new Hono();
workshop.use("*", requireAuth, rbac("workshop", "view"));

// ── Work orders ───────────────────────────────────────────────────────────────
workshop.get("/orders", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM work_orders WHERE tenant_id = ? ORDER BY opened_at DESC")
    .bind(user.tenant_id)
    .all();
  return c.json({ ok: true, data: results });
});

workshop.patch("/orders/:id", rbac("workshop", "edit"), async (c) => {
  const user    = c.get("user");
  const id      = c.req.param("id");
  const updates = await c.req.json().catch(() => ({}));

  const fields  = ["vehicle","plate","tipo","description","status","priority","ponte","cost_eur","mileage_km","closed_at"];
  const allowed = Object.keys(updates).filter(k => fields.includes(k));
  if (!allowed.length) return c.json({ ok: false, error: "Nessun campo valido" }, 400);

  const set    = allowed.map(k => `${k} = ?`).join(", ");
  const values = allowed.map(k => updates[k]);

  await c.env.DB
    .prepare(`UPDATE work_orders SET ${set}, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`)
    .bind(...values, id, user.tenant_id)
    .run();

  const updated = await c.env.DB
    .prepare("SELECT * FROM work_orders WHERE id = ? AND tenant_id = ?")
    .bind(id, user.tenant_id)
    .first();

  if (!updated) return c.json({ ok: false, error: "Ordine non trovato" }, 404);
  return c.json({ ok: true, data: updated });
});

// ── Workshop bays (ponti) ─────────────────────────────────────────────────────
workshop.get("/ponti", async (c) => {
  const user   = c.get("user");
  const tenant = await c.env.DB
    .prepare("SELECT ponti FROM tenants WHERE id = ?")
    .bind(user.tenant_id)
    .first();
  return c.json({ ok: true, data: JSON.parse(tenant?.ponti ?? "[]") });
});

workshop.patch("/ponti", rbac("workshop", "full"), async (c) => {
  const user        = c.get("user");
  const { ponti }   = await c.req.json().catch(() => ({}));
  if (!Array.isArray(ponti)) return c.json({ ok: false, error: "ponti deve essere un array" }, 400);
  const clean = ponti.map(p => String(p).trim()).filter(Boolean);
  await c.env.DB
    .prepare("UPDATE tenants SET ponti = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(JSON.stringify(clean), user.tenant_id)
    .run();
  return c.json({ ok: true, data: clean });
});

// ── Workshop planning (ponte slot assignments) ─────────────────────────────────
workshop.get("/planning", async (c) => {
  const user = c.get("user");
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return c.json({ ok: false, error: "Parametro date richiesto (YYYY-MM-DD)" }, 400);

  const { results } = await c.env.DB
    .prepare("SELECT * FROM workshop_planning WHERE tenant_id = ? AND date = ?")
    .bind(user.tenant_id, date)
    .all();
  return c.json({ ok: true, data: results });
});

workshop.post("/planning", rbac("workshop", "edit"), async (c) => {
  const user                             = c.get("user");
  const { orderId, ponte, date, startHour, duration } = await c.req.json().catch(() => ({}));
  if (!orderId || !ponte || !date || startHour == null)
    return c.json({ ok: false, error: "Campi obbligatori: orderId, ponte, date, startHour" }, 400);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO workshop_planning (id, tenant_id, order_id, ponte, date, start_hour, duration) VALUES (?,?,?,?,?,?,?)")
    .bind(id, user.tenant_id, orderId, ponte, date, Number(startHour), Number(duration) || 2)
    .run();

  return c.json({ ok: true, data: { id, orderId, ponte, date, startHour, duration } }, 201);
});

workshop.delete("/planning/:id", rbac("workshop", "edit"), async (c) => {
  const user = c.get("user");
  const id   = c.req.param("id");
  const { success, meta } = await c.env.DB
    .prepare("DELETE FROM workshop_planning WHERE id = ? AND tenant_id = ?")
    .bind(id, user.tenant_id)
    .run();
  if (!meta.changes) return c.json({ ok: false, error: "Assegnazione non trovata" }, 404);
  return c.json({ ok: true });
});

export default workshop;
