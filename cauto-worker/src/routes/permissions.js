import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const permissions = new Hono();
permissions.use("*", requireAuth);

const MODULES = ["gps","navigation","foto_timbrata","cdr","zone","punti","percorsi","pdf_export","workshop","segnalazioni","fuel","suppliers","costs","planning","territorio","admin"];
const ROLES   = ["company_admin","fleet_manager","responsabile_officina","coordinatore_officina","coordinatore_operativo"];
const LEVELS  = ["none","view","edit","full"];

// GET — full matrix for this tenant
permissions.get("/", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT role, module, level FROM permissions WHERE tenant_id = ?")
    .bind(user.tenant_id)
    .all();

  // Shape into { role: { module: level } }
  const matrix = {};
  for (const row of results) {
    if (!matrix[row.role]) matrix[row.role] = {};
    matrix[row.role][row.module] = row.level;
  }
  return c.json({ ok: true, data: { matrix, roles: ROLES, modules: MODULES, levels: LEVELS } });
});

// PATCH — update matrix (fleet_manager / company_admin only)
permissions.patch("/", rbac("admin", "full"), async (c) => {
  const user   = c.get("user");
  const { matrix } = await c.req.json().catch(() => ({}));
  if (!matrix) return c.json({ ok: false, error: "matrix richiesta" }, 400);

  // Validate and upsert each row
  const stmts = [];
  for (const [role, mods] of Object.entries(matrix)) {
    if (!ROLES.includes(role)) return c.json({ ok: false, error: `Ruolo non valido: ${role}` }, 400);
    for (const [mod, level] of Object.entries(mods)) {
      if (!LEVELS.includes(level)) return c.json({ ok: false, error: `Livello non valido: ${level}` }, 400);
      stmts.push(
        c.env.DB.prepare(
          "INSERT INTO permissions (id,tenant_id,role,module,level) VALUES (?,?,?,?,?) ON CONFLICT(tenant_id,role,module) DO UPDATE SET level=excluded.level"
        ).bind(crypto.randomUUID(), user.tenant_id, role, mod, level)
      );
    }
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

export default permissions;
