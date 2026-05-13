import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const territorio = new Hono();
territorio.use("*", requireAuth, rbac("territorio", "view"));

const VALID_TIPI   = ["mancata_raccolta", "abbandono", "da_pulire", "altro"];
const VALID_STATUS = ["aperta", "in_lavorazione", "chiusa"];

territorio.get("/", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM segnalazioni_territorio WHERE tenant_id = ? ORDER BY created_at DESC")
    .bind(user.tenant_id)
    .all();

  // Attach interventions to each record
  const ids = results.map(r => r.id);
  let interventions = [];
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const { results: ints } = await c.env.DB
      .prepare(`SELECT * FROM segnalazioni_territorio_interventions WHERE segnalazione_id IN (${placeholders}) ORDER BY date ASC`)
      .bind(...ids)
      .all();
    interventions = ints;
  }

  const data = results.map(r => ({
    ...r,
    photos: JSON.parse(r.photos ?? "[]"),
    interventions: interventions.filter(i => i.segnalazione_id === r.id),
  }));
  return c.json({ ok: true, data });
});

territorio.post("/", rbac("territorio", "edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  if (!VALID_TIPI.includes(body.tipo))
    return c.json({ ok: false, error: `tipo non valido. Valori: ${VALID_TIPI.join(", ")}` }, 400);

  // photos should be an array of R2 URLs (uploaded via POST /api/upload first)
  const photos = (body.photos ?? []).filter(p => typeof p === "string" && p.startsWith("http"));

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO segnalazioni_territorio (id,tenant_id,tipo,lat,lng,address,comune,description,photos,reported_by) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id, user.tenant_id, body.tipo, body.lat ?? null, body.lng ?? null,
          body.address ?? "", body.comune ?? "", body.description ?? "",
          JSON.stringify(photos), user.email)
    .run();
  return c.json({ ok: true, data: { id, ...body, photos, status: "aperta", interventions: [] } }, 201);
});

// PATCH /:id/photos — add R2 URLs to an existing segnalazione
territorio.patch("/:id/photos", rbac("territorio", "edit"), async (c) => {
  const user   = c.get("user");
  const id     = c.req.param("id");
  const { photos } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(photos))
    return c.json({ ok: false, error: "photos deve essere un array di URL" }, 400);

  const seg = await c.env.DB
    .prepare("SELECT photos FROM segnalazioni_territorio WHERE id = ? AND tenant_id = ?")
    .bind(id, user.tenant_id).first();
  if (!seg) return c.json({ ok: false, error: "Segnalazione non trovata" }, 404);

  const existing = JSON.parse(seg.photos ?? "[]");
  const merged   = [...new Set([...existing, ...photos.filter(p => typeof p === "string" && p.startsWith("http"))])];

  await c.env.DB
    .prepare("UPDATE segnalazioni_territorio SET photos=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?")
    .bind(JSON.stringify(merged), id, user.tenant_id)
    .run();
  return c.json({ ok: true, data: { photos: merged } });
});

territorio.patch("/:id/status", rbac("territorio", "edit"), async (c) => {
  const user       = c.get("user");
  const id         = c.req.param("id");
  const { status } = await c.req.json().catch(() => ({}));
  if (!VALID_STATUS.includes(status))
    return c.json({ ok: false, error: `status non valido` }, 400);
  const { meta } = await c.env.DB
    .prepare("UPDATE segnalazioni_territorio SET status=?, updated_at=datetime('now') WHERE id=? AND tenant_id=?")
    .bind(status, id, user.tenant_id)
    .run();
  if (!meta.changes) return c.json({ ok: false, error: "Segnalazione non trovata" }, 404);
  return c.json({ ok: true });
});

territorio.post("/:id/interventions", rbac("territorio", "edit"), async (c) => {
  const user = c.get("user");
  const segId = c.req.param("id");
  const body  = await c.req.json().catch(() => ({}));

  // Verify ownership
  const seg = await c.env.DB
    .prepare("SELECT id FROM segnalazioni_territorio WHERE id=? AND tenant_id=?")
    .bind(segId, user.tenant_id).first();
  if (!seg) return c.json({ ok: false, error: "Segnalazione non trovata" }, 404);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO segnalazioni_territorio_interventions (id,segnalazione_id,description,operator_id,date) VALUES (?,?,?,?,datetime('now'))")
    .bind(id, segId, body.description ?? "", user.id)
    .run();

  // Auto-transition to in_lavorazione if still aperta
  await c.env.DB
    .prepare("UPDATE segnalazioni_territorio SET status='in_lavorazione', updated_at=datetime('now') WHERE id=? AND tenant_id=? AND status='aperta'")
    .bind(segId, user.tenant_id)
    .run();

  return c.json({ ok: true, data: { id, segnalazione_id: segId, description: body.description } }, 201);
});

territorio.delete("/:id", rbac("territorio", "full"), async (c) => {
  const user = c.get("user");
  const id   = c.req.param("id");
  await c.env.DB
    .prepare("DELETE FROM segnalazioni_territorio WHERE id=? AND tenant_id=?")
    .bind(id, user.tenant_id)
    .run();
  return c.json({ ok: true });
});

export default territorio;
