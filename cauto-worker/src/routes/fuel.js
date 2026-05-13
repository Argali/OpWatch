import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const fuel = new Hono();
fuel.use("*", requireAuth, rbac("fuel", "view"));

fuel.get("/entries", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM fuel_entries WHERE tenant_id = ? ORDER BY date DESC")
    .bind(user.tenant_id)
    .all();
  return c.json({ ok: true, data: results });
});

fuel.get("/summary", async (c) => {
  const user = c.get("user");
  const row = await c.env.DB
    .prepare(`
      SELECT
        ROUND(SUM(liters), 2)                                       AS total_liters,
        ROUND(SUM(cost_eur), 2)                                     AS total_cost_eur,
        ROUND(AVG(cost_eur / NULLIF(liters, 0)) * 100, 2)          AS avg_cost_per_100l,
        COUNT(*)                                                     AS total_entries
      FROM fuel_entries WHERE tenant_id = ?
    `)
    .bind(user.tenant_id)
    .first();
  return c.json({ ok: true, data: row });
});

export default fuel;
