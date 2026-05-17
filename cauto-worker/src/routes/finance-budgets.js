import { Hono }        from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const finance = new Hono();
finance.use("*", requireAuth, rbac("finance", "view"));

// ── Budgets ───────────────────────────────────────────────────────────────────

finance.get("/budgets", async (c) => {
  const { tenant_id } = c.get("user");
  const sectorId = c.req.query("sector_id");
  const year     = c.req.query("year");

  let query = "SELECT * FROM budgets WHERE tenant_id = ?";
  const params = [tenant_id];
  if (sectorId) { query += " AND sector_id = ?"; params.push(sectorId); }
  if (year)     { query += " AND year_start <= ? AND year_end >= ?"; params.push(year, year); }
  query += " ORDER BY year_start DESC, label";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ ok: true, data: results });
});

finance.post("/budgets", rbac("finance", "edit"), async (c) => {
  const { tenant_id } = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const { label, sector_id, type = "annual", year_start, year_end, total_amount = 0, currency = "EUR" } = body;

  if (!label?.trim() || !sector_id || !year_start || !year_end)
    return c.json({ ok: false, error: "Campi obbligatori: label, sector_id, year_start, year_end" }, 400);

  const sector = await c.env.DB
    .prepare("SELECT id FROM budget_sectors WHERE id = ? AND tenant_id = ?")
    .bind(sector_id, tenant_id).first();
  if (!sector) return c.json({ ok: false, error: "Settore non trovato" }, 404);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(`INSERT INTO budgets
      (id, tenant_id, sector_id, label, type, year_start, year_end, total_amount, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, tenant_id, sector_id, label.trim(), type, Number(year_start), Number(year_end), Number(total_amount), currency)
    .run();

  const created = await c.env.DB.prepare("SELECT * FROM budgets WHERE id = ?").bind(id).first();
  return c.json({ ok: true, data: created }, 201);
});

finance.patch("/budgets/:id", rbac("finance", "edit"), async (c) => {
  const { tenant_id } = c.get("user");
  const id   = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const fields  = ["label", "type", "year_start", "year_end", "total_amount", "currency"];
  const allowed = Object.keys(body).filter(k => fields.includes(k));
  if (!allowed.length) return c.json({ ok: false, error: "Nessun campo valido" }, 400);

  const set    = allowed.map(k => `${k} = ?`).join(", ");
  const values = allowed.map(k => body[k]);

  const { meta } = await c.env.DB
    .prepare(`UPDATE budgets SET ${set}, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`)
    .bind(...values, id, tenant_id).run();
  if (!meta.changes) return c.json({ ok: false, error: "Budget non trovato" }, 404);

  const updated = await c.env.DB.prepare("SELECT * FROM budgets WHERE id = ?").bind(id).first();
  return c.json({ ok: true, data: updated });
});

finance.delete("/budgets/:id", rbac("finance", "edit"), async (c) => {
  const { tenant_id } = c.get("user");
  const id = c.req.param("id");
  const { meta } = await c.env.DB
    .prepare("DELETE FROM budgets WHERE id = ? AND tenant_id = ?")
    .bind(id, tenant_id).run();
  if (!meta.changes) return c.json({ ok: false, error: "Budget non trovato" }, 404);
  return c.json({ ok: true });
});

// ── Budget lines (monthly breakdown) ─────────────────────────────────────────

finance.get("/budgets/:id/lines", async (c) => {
  const { tenant_id } = c.get("user");
  const budgetId = c.req.param("id");

  const budget = await c.env.DB
    .prepare("SELECT id FROM budgets WHERE id = ? AND tenant_id = ?")
    .bind(budgetId, tenant_id).first();
  if (!budget) return c.json({ ok: false, error: "Budget non trovato" }, 404);

  const { results } = await c.env.DB
    .prepare("SELECT * FROM budget_lines WHERE budget_id = ? ORDER BY year, month")
    .bind(budgetId).all();
  return c.json({ ok: true, data: results });
});

finance.put("/budgets/:id/lines", rbac("finance", "edit"), async (c) => {
  const { tenant_id } = c.get("user");
  const budgetId = c.req.param("id");
  const { lines } = await c.req.json().catch(() => ({}));

  if (!Array.isArray(lines))
    return c.json({ ok: false, error: "lines deve essere un array" }, 400);

  const budget = await c.env.DB
    .prepare("SELECT id FROM budgets WHERE id = ? AND tenant_id = ?")
    .bind(budgetId, tenant_id).first();
  if (!budget) return c.json({ ok: false, error: "Budget non trovato" }, 404);

  const stmts = lines.map(({ year, month, amount }) =>
    c.env.DB.prepare(`
      INSERT INTO budget_lines (id, budget_id, tenant_id, year, month, amount)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(budget_id, year, month) DO UPDATE SET
        amount     = excluded.amount,
        updated_at = datetime('now')
    `).bind(crypto.randomUUID(), budgetId, tenant_id, Number(year), Number(month), Number(amount))
  );

  if (stmts.length) await c.env.DB.batch(stmts);

  const { results } = await c.env.DB
    .prepare("SELECT * FROM budget_lines WHERE budget_id = ? ORDER BY year, month")
    .bind(budgetId).all();
  return c.json({ ok: true, data: results });
});

// ── Forecasts ─────────────────────────────────────────────────────────────────

finance.get("/budgets/:id/forecasts", async (c) => {
  const { tenant_id } = c.get("user");
  const budgetId = c.req.param("id");

  const budget = await c.env.DB
    .prepare("SELECT id FROM budgets WHERE id = ? AND tenant_id = ?")
    .bind(budgetId, tenant_id).first();
  if (!budget) return c.json({ ok: false, error: "Budget non trovato" }, 404);

  const { results } = await c.env.DB
    .prepare("SELECT * FROM budget_forecasts WHERE budget_id = ? ORDER BY year, month, revised_at DESC")
    .bind(budgetId).all();
  return c.json({ ok: true, data: results });
});

finance.post("/budgets/:id/forecasts", rbac("finance", "edit"), async (c) => {
  const { tenant_id, email } = c.get("user");
  const budgetId = c.req.param("id");
  const { year, month, revised_amount, note = "" } = await c.req.json().catch(() => ({}));

  if (!year || !month || revised_amount == null)
    return c.json({ ok: false, error: "Campi obbligatori: year, month, revised_amount" }, 400);

  const budget = await c.env.DB
    .prepare("SELECT id FROM budgets WHERE id = ? AND tenant_id = ?")
    .bind(budgetId, tenant_id).first();
  if (!budget) return c.json({ ok: false, error: "Budget non trovato" }, 404);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(`INSERT INTO budget_forecasts
      (id, budget_id, tenant_id, year, month, revised_amount, note, revised_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, budgetId, tenant_id, Number(year), Number(month), Number(revised_amount), note, email ?? null)
    .run();

  const created = await c.env.DB
    .prepare("SELECT * FROM budget_forecasts WHERE id = ?").bind(id).first();
  return c.json({ ok: true, data: created }, 201);
});

// ── Actuals (read-only — written by cron) ─────────────────────────────────────

finance.get("/actuals", async (c) => {
  const { tenant_id } = c.get("user");
  const sectorId = c.req.query("sector_id");
  const year     = c.req.query("year");
  const month    = c.req.query("month");

  let query = "SELECT * FROM budget_actuals WHERE tenant_id = ?";
  const params = [tenant_id];
  if (sectorId) { query += " AND sector_id = ?"; params.push(sectorId); }
  if (year)     { query += " AND year = ?";       params.push(Number(year)); }
  if (month)    { query += " AND month = ?";      params.push(Number(month)); }
  query += " ORDER BY year DESC, month DESC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ ok: true, data: results });
});

// ── Dashboard summary: budget + actuals + latest forecast per sector/month ────

finance.get("/summary", async (c) => {
  const { tenant_id } = c.get("user");
  const year  = Number(c.req.query("year")  ?? new Date().getUTCFullYear());
  const month = Number(c.req.query("month") ?? new Date().getUTCMonth() + 1);

  const { results: actuals } = await c.env.DB
    .prepare("SELECT * FROM budget_actuals WHERE tenant_id = ? AND year = ? AND month = ?")
    .bind(tenant_id, year, month).all();

  const { results: lines } = await c.env.DB
    .prepare(`SELECT bl.*, b.sector_id
              FROM budget_lines bl
              JOIN budgets b ON b.id = bl.budget_id
              WHERE bl.tenant_id = ? AND bl.year = ? AND bl.month = ?`)
    .bind(tenant_id, year, month).all();

  const { results: forecasts } = await c.env.DB
    .prepare(`SELECT bf.*, b.sector_id
              FROM budget_forecasts bf
              JOIN budgets b ON b.id = bf.budget_id
              WHERE bf.tenant_id = ? AND bf.year = ? AND bf.month = ?
              ORDER BY bf.revised_at DESC`)
    .bind(tenant_id, year, month).all();

  // Latest forecast per sector
  const latestForecast = {};
  for (const f of forecasts) {
    if (!latestForecast[f.sector_id]) latestForecast[f.sector_id] = f;
  }

  // Budget (line amount) per sector
  const budgetBySector = {};
  for (const l of lines) {
    budgetBySector[l.sector_id] = (budgetBySector[l.sector_id] ?? 0) + l.amount;
  }

  const data = actuals.map(a => ({
    sector_id:        a.sector_id,
    year:             a.year,
    month:            a.month,
    fuel_total:       a.fuel_total,
    maintenance_total: a.maintenance_total,
    operations_total: a.operations_total,
    total:            a.total,
    budget:           budgetBySector[a.sector_id] ?? null,
    forecast:         latestForecast[a.sector_id]?.revised_amount ?? null,
    computed_at:      a.computed_at,
  }));

  return c.json({ ok: true, data, meta: { year, month } });
});

export default finance;
