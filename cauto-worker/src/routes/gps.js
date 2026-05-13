import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const gps = new Hono();
gps.use("*", requireAuth, rbac("gps", "view"));

// ── Mock vehicles (replaced by live adapter when Visirun is authorised) ───────
const MOCK_VEHICLES = [
  { id:"v1", plate:"FE-123-AA", name:"Camion 01", status:"active", lat:44.8381, lng:11.6198, speed:35, comune:"Ferrara", settore:"A" },
  { id:"v2", plate:"FE-456-BB", name:"Camion 02", status:"active", lat:44.8321, lng:11.6301, speed:0,  comune:"Ferrara", settore:"B" },
  { id:"v3", plate:"FE-789-CC", name:"Furgone 01",status:"active", lat:44.8412, lng:11.6089, speed:28, comune:"Ferrara", settore:"A" },
  { id:"v4", plate:"FE-012-DD", name:"Camion 03", status:"workshop",lat:44.8290,lng:11.6250, speed:0,  comune:"Ferrara", settore:"C" },
];

gps.get("/vehicles", async (c) => {
  // When GPS_PROVIDER env var is set to 'visirun', swap mock for live adapter here
  return c.json({ ok: true, data: MOCK_VEHICLES, source: "mock" });
});

// ── Routes (percorsi) — stored in D1 ─────────────────────────────────────────
gps.get("/routes", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM routes WHERE tenant_id = ? ORDER BY created_at DESC")
    .bind(user.tenant_id)
    .all();
  return c.json({ ok: true, data: results.map(r => ({ ...r, waypoints: JSON.parse(r.waypoints_json) })) });
});

gps.post("/routes", rbac("gps", "edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const id   = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO routes (id,tenant_id,name,color,opacity,comune,materiale,sector,waypoints_json) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id, user.tenant_id, body.name ?? "", body.color ?? "#4ade80", body.opacity ?? 0.85,
          body.comune ?? "", body.materiale ?? "", body.sector ?? "", JSON.stringify(body.waypoints ?? []))
    .run();
  return c.json({ ok: true, data: { id, ...body } }, 201);
});

gps.patch("/routes/:id", rbac("gps", "edit"), async (c) => {
  const user = c.get("user");
  const id   = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  await c.env.DB
    .prepare("UPDATE routes SET name=?,color=?,opacity=?,comune=?,materiale=?,sector=?,waypoints_json=?,updated_at=datetime('now') WHERE id=? AND tenant_id=?")
    .bind(body.name, body.color, body.opacity, body.comune, body.materiale, body.sector,
          JSON.stringify(body.waypoints ?? []), id, user.tenant_id)
    .run();
  return c.json({ ok: true });
});

gps.delete("/routes/:id", rbac("gps", "edit"), async (c) => {
  const user = c.get("user");
  const id   = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM routes WHERE id=? AND tenant_id=?").bind(id, user.tenant_id).run();
  return c.json({ ok: true });
});

// ── Zones ────────────────────────────────────────────────────────────────────
gps.get("/zones", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM zones WHERE tenant_id = ? ORDER BY created_at DESC")
    .bind(user.tenant_id)
    .all();
  return c.json({ ok: true, data: results.map(z => ({ ...z, vertices: JSON.parse(z.vertices_json) })) });
});

gps.post("/zones", rbac("gps", "edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const id   = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO zones (id,tenant_id,name,type,comune,materiale,sector,fill_color,fill_opacity,border_color,vertices_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, user.tenant_id, body.name ?? "", body.type ?? "circle",
          body.comune ?? "", body.materiale ?? "", body.sector ?? "",
          body.fillColor ?? "#60a5fa", body.fillOpacity ?? 0.3, body.borderColor ?? "#3a7bd5",
          JSON.stringify(body.vertices ?? []))
    .run();
  return c.json({ ok: true, data: { id, ...body } }, 201);
});

gps.delete("/zones/:id", rbac("gps", "edit"), async (c) => {
  const user = c.get("user");
  await c.env.DB.prepare("DELETE FROM zones WHERE id=? AND tenant_id=?").bind(c.req.param("id"), user.tenant_id).run();
  return c.json({ ok: true });
});

// ── Points of interest (punti) ────────────────────────────────────────────────
gps.get("/punti", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM punti WHERE tenant_id = ? ORDER BY created_at DESC")
    .bind(user.tenant_id)
    .all();
  return c.json({ ok: true, data: results });
});

gps.post("/punti", rbac("gps", "edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const id   = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO punti (id,tenant_id,nome,comune,materiale,sector,color,lat,lng) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id, user.tenant_id, body.nome ?? "", body.comune ?? "", body.materiale ?? "",
          body.sector ?? "", body.color ?? "#f87171", body.lat ?? null, body.lng ?? null)
    .run();
  return c.json({ ok: true, data: { id, ...body } }, 201);
});

gps.delete("/punti/:id", rbac("gps", "edit"), async (c) => {
  const user = c.get("user");
  await c.env.DB.prepare("DELETE FROM punti WHERE id=? AND tenant_id=?").bind(c.req.param("id"), user.tenant_id).run();
  return c.json({ ok: true });
});

export default gps;
