import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const costs = new Hono();
costs.use("*", requireAuth, rbac("costs", "view"));

costs.get("/monthly", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM monthly_costs WHERE tenant_id = ? ORDER BY month DESC")
    .bind(user.tenant_id)
    .all();
  return c.json({ ok: true, data: results });
});

export default costs;
