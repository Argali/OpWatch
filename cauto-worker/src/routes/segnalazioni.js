import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const segnalazioni = new Hono();
segnalazioni.use("*", requireAuth, rbac("segnalazioni", "view"));

const VALID_TIPI   = ["guasto", "incidente", "manutenzione"];
const VALID_STATUS = ["aperta", "in_lavorazione", "chiusa"];

segnalazioni.get("/", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM segnalazioni WHERE tenant_id = ? ORDER BY created_at DESC")
    .bind(user.tenant_id)
    .all();
  return c.json({ ok: true, data: results });
});

segnalazioni.post("/", rbac("segnalazioni", "edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  if (!VALID_TIPI.includes(body.tipo))
    return c.json({ ok: false, error: `tipo non valido. Valori: ${VALID_TIPI.join(", ")}` }, 400);
  if (!body.vehicle)
    return c.json({ ok: false, error: "vehicle richiesto" }, 400);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(`INSERT INTO segnalazioni
      (id,tenant_id,tipo,vehicle,plate,description,reported_by,settore,reporter_name,available_from,photo_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, user.tenant_id, body.tipo, body.vehicle,
          body.plate ?? "", body.description ?? "", user.email,
          body.settore ?? "", body.reporter_name ?? user.name ?? "",
          body.available_from ?? null, body.photo_url ?? null)
    .run();
  return c.json({ ok: true, data: { id, ...body, status: "aperta", tenant_id: user.tenant_id } }, 201);
});

segnalazioni.patch("/:id/status", rbac("segnalazioni", "edit"), async (c) => {
  const user   = c.get("user");
  const id     = c.req.param("id");
  const { status } = await c.req.json().catch(() => ({}));
  if (!VALID_STATUS.includes(status))
    return c.json({ ok: false, error: `status non valido. Valori: ${VALID_STATUS.join(", ")}` }, 400);

  const { meta } = await c.env.DB
    .prepare("UPDATE segnalazioni SET status=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?")
    .bind(status, id, user.tenant_id)
    .run();
  if (!meta.changes) return c.json({ ok: false, error: "Segnalazione non trovata" }, 404);
  return c.json({ ok: true });
});

segnalazioni.patch("/:id/ponte", rbac("segnalazioni", "edit"), async (c) => {
  const user         = c.get("user");
  const id           = c.req.param("id");
  const { ponte }    = await c.req.json().catch(() => ({}));
  const { meta } = await c.env.DB
    .prepare("UPDATE segnalazioni SET ponte=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?")
    .bind(ponte ?? null, id, user.tenant_id)
    .run();
  if (!meta.changes) return c.json({ ok: false, error: "Segnalazione non trovata" }, 404);
  return c.json({ ok: true });
});

export default segnalazioni;
