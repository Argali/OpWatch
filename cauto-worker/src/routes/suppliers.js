import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const suppliers = new Hono();
suppliers.use("*", requireAuth, rbac("suppliers", "view"));

suppliers.get("/", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM suppliers WHERE tenant_id = ? AND active = 1 ORDER BY name")
    .bind(user.tenant_id)
    .all();
  return c.json({ ok: true, data: results });
});

export default suppliers;
