/**
 * Bug / feedback report routes
 *
 * POST /api/bugs          — any authenticated user can file a report
 * GET  /api/bugs          — superadmin only
 * PATCH /api/bugs/:id     — superadmin only (update status)
 */

import { Hono }        from "hono";
import { requireAuth } from "../middleware/auth.js";

const VALID_CATEGORIES = ["ui", "funzionalita", "performance", "errore", "altro"];
const VALID_STATUSES   = ["new", "in_progress", "resolved", "wontfix"];

const bugs = new Hono();
bugs.use("*", requireAuth);

// POST / — create a bug report (any logged-in user)
bugs.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));

  if (!body.title?.trim())
    return c.json({ ok: false, error: "Titolo obbligatorio" }, 400);
  if (!body.description?.trim())
    return c.json({ ok: false, error: "Descrizione obbligatoria" }, 400);

  const id = crypto.randomUUID();
  const category = VALID_CATEGORIES.includes(body.category) ? body.category : "altro";

  await c.env.DB
    .prepare(`INSERT INTO bugs (id, tenant_id, title, description, status, reported_by)
              VALUES (?, ?, ?, ?, 'new', ?)`)
    .bind(id, user.tenant_id, body.title.trim(), body.description.trim(),
          JSON.stringify({ id: user.id, name: user.name, email: user.email, category, steps: body.steps?.trim() || "" }))
    .run();

  return c.json({ ok: true, data: { id, title: body.title, status: "new" } }, 201);
});

// GET / — list all bugs (superadmin only)
bugs.get("/", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin")
    return c.json({ ok: false, error: "Accesso riservato al superadmin" }, 403);

  const { results } = await c.env.DB
    .prepare("SELECT * FROM bugs ORDER BY created_at DESC LIMIT 500")
    .all();

  return c.json({
    ok: true,
    data: results.map(b => ({
      ...b,
      reported_by: (() => { try { return JSON.parse(b.reported_by); } catch { return b.reported_by; } })(),
    })),
  });
});

// PATCH /:id — update status (superadmin only)
bugs.patch("/:id", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin")
    return c.json({ ok: false, error: "Accesso riservato al superadmin" }, 403);

  const id     = c.req.param("id");
  const body   = await c.req.json().catch(() => ({}));
  const status = body.status;

  if (!VALID_STATUSES.includes(status))
    return c.json({ ok: false, error: `Status non valido. Valori: ${VALID_STATUSES.join(", ")}` }, 400);

  const { meta } = await c.env.DB
    .prepare("UPDATE bugs SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(status, id)
    .run();

  if (!meta.changes) return c.json({ ok: false, error: "Bug non trovato" }, 404);
  return c.json({ ok: true, data: { id, status } });
});

export default bugs;
