/**
 * RBAC middleware — checks D1 permissions table.
 * Usage: rbac("workshop", "edit")
 *
 * Permission levels in order: none → view → edit → full
 */

const LEVELS = ["none", "view", "edit", "full"];

function hasAccess(userLevel, required) {
  return LEVELS.indexOf(userLevel) >= LEVELS.indexOf(required);
}

export function rbac(module, required = "view") {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ ok: false, error: "Non autenticato" }, 401);

    // Superadmin bypasses all checks
    if (user.role === "superadmin") { await next(); return; }

    const row = await c.env.DB
      .prepare("SELECT level FROM permissions WHERE tenant_id = ? AND role = ? AND module = ?")
      .bind(user.tenant_id, user.role, module)
      .first();

    const level = row?.level ?? "none";
    if (!hasAccess(level, required)) {
      return c.json({ ok: false, error: `Accesso negato — richiesto: ${required}` }, 403);
    }

    c.set("permLevel", level);
    await next();
  };
}
