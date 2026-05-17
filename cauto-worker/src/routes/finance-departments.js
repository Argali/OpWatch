import { Hono }        from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const finance = new Hono();
finance.use("*", requireAuth, rbac("finance", "view"));

// ── Departments ───────────────────────────────────────────────────────────────

finance.get("/departments", async (c) => {
  const { tenant_id } = c.get("user");

  const { results: depts } = await c.env.DB
    .prepare("SELECT * FROM budget_departments WHERE tenant_id = ? ORDER BY name")
    .bind(tenant_id).all();

  const { results: sectors } = await c.env.DB
    .prepare("SELECT * FROM budget_sectors WHERE tenant_id = ? ORDER BY name")
    .bind(tenant_id).all();

  const sectorsByDept = {};
  for (const s of sectors) {
    if (!sectorsByDept[s.department_id]) sectorsByDept[s.department_id] = [];
    sectorsByDept[s.department_id].push(s);
  }

  const data = depts.map(d => ({ ...d, sectors: sectorsByDept[d.id] ?? [] }));
  return c.json({ ok: true, data });
});

finance.post("/departments", rbac("finance", "edit"), async (c) => {
  const { tenant_id } = c.get("user");
  const { name } = await c.req.json().catch(() => ({}));
  if (!name?.trim()) return c.json({ ok: false, error: "name è obbligatorio" }, 400);

  const existing = await c.env.DB
    .prepare("SELECT id FROM budget_departments WHERE tenant_id = ? AND name = ?")
    .bind(tenant_id, name.trim()).first();
  if (existing) return c.json({ ok: false, error: "Dipartimento già esistente" }, 409);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO budget_departments (id, tenant_id, name) VALUES (?, ?, ?)")
    .bind(id, tenant_id, name.trim()).run();

  const created = await c.env.DB
    .prepare("SELECT * FROM budget_departments WHERE id = ?")
    .bind(id).first();
  return c.json({ ok: true, data: created }, 201);
});

finance.patch("/departments/:id", rbac("finance", "edit"), async (c) => {
  const { tenant_id } = c.get("user");
  const id = c.req.param("id");
  const { name } = await c.req.json().catch(() => ({}));
  if (!name?.trim()) return c.json({ ok: false, error: "name è obbligatorio" }, 400);

  const existing = await c.env.DB
    .prepare("SELECT id FROM budget_departments WHERE tenant_id = ? AND name = ? AND id != ?")
    .bind(tenant_id, name.trim(), id).first();
  if (existing) return c.json({ ok: false, error: "Nome già in uso" }, 409);

  const { meta } = await c.env.DB
    .prepare("UPDATE budget_departments SET name = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
    .bind(name.trim(), id, tenant_id).run();
  if (!meta.changes) return c.json({ ok: false, error: "Dipartimento non trovato" }, 404);

  const updated = await c.env.DB
    .prepare("SELECT * FROM budget_departments WHERE id = ?")
    .bind(id).first();
  return c.json({ ok: true, data: updated });
});

finance.delete("/departments/:id", rbac("finance", "edit"), async (c) => {
  const { tenant_id } = c.get("user");
  const id = c.req.param("id");

  const child = await c.env.DB
    .prepare("SELECT id FROM budget_sectors WHERE department_id = ? AND tenant_id = ? LIMIT 1")
    .bind(id, tenant_id).first();
  if (child) return c.json({ ok: false, error: "Impossibile eliminare: esistono settori collegati" }, 409);

  const { meta } = await c.env.DB
    .prepare("DELETE FROM budget_departments WHERE id = ? AND tenant_id = ?")
    .bind(id, tenant_id).run();
  if (!meta.changes) return c.json({ ok: false, error: "Dipartimento non trovato" }, 404);

  return c.json({ ok: true });
});

// ── Sectors ───────────────────────────────────────────────────────────────────

finance.get("/sectors", async (c) => {
  const { tenant_id } = c.get("user");
  const deptId = c.req.query("department_id");

  let query = "SELECT * FROM budget_sectors WHERE tenant_id = ?";
  const params = [tenant_id];
  if (deptId) { query += " AND department_id = ?"; params.push(deptId); }
  query += " ORDER BY name";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ ok: true, data: results });
});

finance.post("/sectors", rbac("finance", "edit"), async (c) => {
  const { tenant_id } = c.get("user");
  const { name, department_id } = await c.req.json().catch(() => ({}));
  if (!name?.trim() || !department_id)
    return c.json({ ok: false, error: "name e department_id sono obbligatori" }, 400);

  const dept = await c.env.DB
    .prepare("SELECT id FROM budget_departments WHERE id = ? AND tenant_id = ?")
    .bind(department_id, tenant_id).first();
  if (!dept) return c.json({ ok: false, error: "Dipartimento non trovato" }, 404);

  const existing = await c.env.DB
    .prepare("SELECT id FROM budget_sectors WHERE tenant_id = ? AND department_id = ? AND name = ?")
    .bind(tenant_id, department_id, name.trim()).first();
  if (existing) return c.json({ ok: false, error: "Settore già esistente in questo dipartimento" }, 409);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO budget_sectors (id, tenant_id, department_id, name) VALUES (?, ?, ?, ?)")
    .bind(id, tenant_id, department_id, name.trim()).run();

  const created = await c.env.DB
    .prepare("SELECT * FROM budget_sectors WHERE id = ?")
    .bind(id).first();
  return c.json({ ok: true, data: created }, 201);
});

finance.patch("/sectors/:id", rbac("finance", "edit"), async (c) => {
  const { tenant_id } = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const sector = await c.env.DB
    .prepare("SELECT * FROM budget_sectors WHERE id = ? AND tenant_id = ?")
    .bind(id, tenant_id).first();
  if (!sector) return c.json({ ok: false, error: "Settore non trovato" }, 404);

  const name   = body.name?.trim()         ?? sector.name;
  const deptId = body.department_id?.trim() ?? sector.department_id;

  if (deptId !== sector.department_id) {
    const dept = await c.env.DB
      .prepare("SELECT id FROM budget_departments WHERE id = ? AND tenant_id = ?")
      .bind(deptId, tenant_id).first();
    if (!dept) return c.json({ ok: false, error: "Dipartimento di destinazione non trovato" }, 404);
  }

  const collision = await c.env.DB
    .prepare("SELECT id FROM budget_sectors WHERE tenant_id = ? AND department_id = ? AND name = ? AND id != ?")
    .bind(tenant_id, deptId, name, id).first();
  if (collision) return c.json({ ok: false, error: "Nome già in uso in questo dipartimento" }, 409);

  await c.env.DB
    .prepare("UPDATE budget_sectors SET name = ?, department_id = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?")
    .bind(name, deptId, id, tenant_id).run();

  const updated = await c.env.DB
    .prepare("SELECT * FROM budget_sectors WHERE id = ?")
    .bind(id).first();
  return c.json({ ok: true, data: updated });
});

finance.delete("/sectors/:id", rbac("finance", "edit"), async (c) => {
  const { tenant_id } = c.get("user");
  const id = c.req.param("id");

  const budget = await c.env.DB
    .prepare("SELECT id FROM budgets WHERE sector_id = ? AND tenant_id = ? LIMIT 1")
    .bind(id, tenant_id).first();
  if (budget) return c.json({ ok: false, error: "Impossibile eliminare: esistono budget collegati" }, 409);

  const actual = await c.env.DB
    .prepare("SELECT id FROM budget_actuals WHERE sector_id = ? AND tenant_id = ? LIMIT 1")
    .bind(id, tenant_id).first();
  if (actual) return c.json({ ok: false, error: "Impossibile eliminare: esistono consuntivi collegati" }, 409);

  const vehicle = await c.env.DB
    .prepare("SELECT id FROM vehicles WHERE sector_id = ? AND tenant_id = ? LIMIT 1")
    .bind(id, tenant_id).first();
  if (vehicle) return c.json({ ok: false, error: "Impossibile eliminare: veicoli assegnati a questo settore" }, 409);

  const event = await c.env.DB
    .prepare("SELECT id FROM planning_events WHERE sector_id = ? AND tenant_id = ? LIMIT 1")
    .bind(id, tenant_id).first();
  if (event) return c.json({ ok: false, error: "Impossibile eliminare: eventi di pianificazione collegati" }, 409);

  const { meta } = await c.env.DB
    .prepare("DELETE FROM budget_sectors WHERE id = ? AND tenant_id = ?")
    .bind(id, tenant_id).run();
  if (!meta.changes) return c.json({ ok: false, error: "Settore non trovato" }, 404);

  return c.json({ ok: true });
});

export default finance;
