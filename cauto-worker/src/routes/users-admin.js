import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";
import { hashPassword } from "../lib/crypto.js";

const usersAdmin = new Hono();
usersAdmin.use("*", requireAuth, rbac("admin", "full"));

const VALID_ROLES = ["fleet_manager","responsabile_officina","coordinatore_officina","coordinatore_operativo","company_admin"];

usersAdmin.get("/", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT id,name,email,role,active,auth_provider,created_at FROM users WHERE tenant_id = ? ORDER BY name")
    .bind(user.tenant_id)
    .all();
  return c.json({ ok: true, data: results });
});

usersAdmin.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  if (!body.email || !body.name || !body.role)
    return c.json({ ok: false, error: "email, name, role richiesti" }, 400);
  if (!VALID_ROLES.includes(body.role))
    return c.json({ ok: false, error: "Ruolo non valido" }, 400);

  const existing = await c.env.DB
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(body.email.toLowerCase().trim())
    .first();
  if (existing) return c.json({ ok: false, error: "Email già registrata" }, 409);

  const id       = crypto.randomUUID();
  const provider = body.auth_provider ?? "azure";
  const hash     = provider === "local" && body.password
    ? await hashPassword(body.password)
    : null;

  await c.env.DB
    .prepare("INSERT INTO users (id,name,email,password_hash,role,tenant_id,active,auth_provider) VALUES (?,?,?,?,?,?,1,?)")
    .bind(id, body.name, body.email.toLowerCase().trim(), hash, body.role, user.tenant_id, provider)
    .run();

  return c.json({ ok: true, data: { id, name: body.name, email: body.email, role: body.role, active: true } }, 201);
});

usersAdmin.patch("/:id", async (c) => {
  const user    = c.get("user");
  const id      = c.req.param("id");
  const body    = await c.req.json().catch(() => ({}));
  const allowed = ["name","role","active"];
  const fields  = Object.keys(body).filter(k => allowed.includes(k));
  if (!fields.length) return c.json({ ok: false, error: "Nessun campo valido" }, 400);
  if (body.role && !VALID_ROLES.includes(body.role))
    return c.json({ ok: false, error: "Ruolo non valido" }, 400);

  const set    = fields.map(k => `${k} = ?`).join(", ");
  const values = fields.map(k => body[k]);
  await c.env.DB
    .prepare(`UPDATE users SET ${set}, updated_at=datetime('now') WHERE id=? AND tenant_id=?`)
    .bind(...values, id, user.tenant_id)
    .run();

  return c.json({ ok: true });
});

usersAdmin.delete("/:id", async (c) => {
  const user = c.get("user");
  const id   = c.req.param("id");
  // Soft delete — never hard delete users
  await c.env.DB
    .prepare("UPDATE users SET active=0, updated_at=datetime('now') WHERE id=? AND tenant_id=?")
    .bind(id, user.tenant_id)
    .run();
  return c.json({ ok: true });
});

export default usersAdmin;
