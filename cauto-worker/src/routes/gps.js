import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const gps = new Hono();
gps.use("*", requireAuth, rbac("gps", "view"));

// ── Valhalla helpers ──────────────────────────────────────────────────────────
function decodePolyline6(encoded) {
  const coords = []; let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
    coords.push([lat / 1e6, lng / 1e6]);
  }
  return coords;
}

async function callValhalla(env, endpoint, body, timeoutMs = 12000) {
  const base = env.VALHALLA_URL || "https://valhalla1.openstreetmap.de";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Mock vehicles (fallback when GPS_PROVIDER != "geotab") ───────────────────
const MOCK_VEHICLES = [
  { id:"v1", plate:"FE-123-AA", name:"Camion 01", status:"active",   lat:44.8381, lng:11.6198, speed_kmh:35, comune:"Ferrara", settore:"A" },
  { id:"v2", plate:"FE-456-BB", name:"Camion 02", status:"active",   lat:44.8321, lng:11.6301, speed_kmh:0,  comune:"Ferrara", settore:"B" },
  { id:"v3", plate:"FE-789-CC", name:"Furgone 01",status:"active",   lat:44.8412, lng:11.6089, speed_kmh:28, comune:"Ferrara", settore:"A" },
  { id:"v4", plate:"FE-012-DD", name:"Camion 03", status:"workshop", lat:44.8290, lng:11.6250, speed_kmh:0,  comune:"Ferrara", settore:"C" },
];

// ── Geotab MyGeotab API adapter ───────────────────────────────────────────────
const GT_SESSION_KEY = "geotab:session";

async function gtRefreshSession(env) {
  const server = env.GEOTAB_SERVER || "my.geotab.com";
  const res = await fetch(`https://${server}/apiv1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "Authenticate",
      params: { database: env.GEOTAB_DATABASE, userName: env.GEOTAB_USERNAME, password: env.GEOTAB_PASSWORD },
    }),
  });
  const { result, error } = await res.json();
  if (!result) throw new Error(`Geotab auth failed: ${error?.message || "unknown"}`);
  const creds = {
    database: env.GEOTAB_DATABASE,
    sessionId: result.credentials.sessionId,
    userName: env.GEOTAB_USERNAME,
    server: result.path || server,
  };
  await env.SESSIONS.put(GT_SESSION_KEY, JSON.stringify(creds), { expirationTtl: 82800 }); // 23 h
  return creds;
}

async function gtCall(env, method, params) {
  let creds = await env.SESSIONS.get(GT_SESSION_KEY, "json") || await gtRefreshSession(env);
  const doCall = async (c) => {
    const res = await fetch(`https://${c.server || env.GEOTAB_SERVER}/apiv1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params: { ...params, credentials: c } }),
    });
    return res.json();
  };
  let data = await doCall(creds);
  // Session expired → refresh once and retry
  if (data.error?.data?.type === "InvalidUserException") {
    await env.SESSIONS.delete(GT_SESSION_KEY);
    creds = await gtRefreshSession(env);
    data = await doCall(creds);
  }
  if (data.error) throw new Error(data.error.message || "Geotab API error");
  return data.result;
}

function mapGeotabVehicles(statusList, deviceList) {
  const byId = new Map((deviceList || []).map(d => [d.id, d]));
  return (statusList || [])
    .filter(s => s.latitude != null && s.longitude != null)
    .map(s => {
      const d = byId.get(s.device?.id) || {};
      return {
        id:        s.device?.id || "",
        name:      d.name || s.device?.id || "",
        plate:     d.licensePlate || "",
        status:    s.isDeviceCommunicating ? "active" : "inactive",
        lat:       s.latitude,
        lng:       s.longitude,
        speed_kmh: Math.round(s.speed || 0),
        comune:    "",
        settore:   "",
      };
    });
}

gps.get("/vehicles", async (c) => {
  if (c.env.GPS_PROVIDER === "geotab") {
    try {
      const [statusList, deviceList] = await Promise.all([
        gtCall(c.env, "Get", { typeName: "DeviceStatusInfo" }),
        gtCall(c.env, "Get", { typeName: "Device" }),
      ]);
      return c.json({ ok: true, data: mapGeotabVehicles(statusList, deviceList), source: "geotab" });
    } catch (err) {
      console.error("Geotab error:", err.message);
      return c.json({ ok: false, error: "Errore Geotab: " + err.message }, 502);
    }
  }
  return c.json({ ok: true, data: MOCK_VEHICLES, source: "mock" });
});

// ── Driver live-location sharing (KV, 5-min TTL, ephemeral) ──────────────────
// Key pattern: loc:{tenantId}:{userId}

gps.post("/driver-location", async (c) => {
  const user = c.get("user");
  const { lat, lng } = await c.req.json().catch(() => ({}));
  if (lat == null || lng == null)
    return c.json({ ok: false, error: "lat e lng obbligatori" }, 400);

  const key = `loc:${user.tenant_id}:${user.id}`;
  await c.env.SESSIONS.put(key, JSON.stringify({
    userId: user.id, name: user.name, email: user.email,
    lat, lng, updatedAt: new Date().toISOString(),
  }), { expirationTtl: 300 });

  return c.json({ ok: true });
});

gps.delete("/driver-location", async (c) => {
  const user = c.get("user");
  await c.env.SESSIONS.delete(`loc:${user.tenant_id}:${user.id}`);
  return c.json({ ok: true });
});

gps.get("/driver-locations", async (c) => {
  const user    = c.get("user");
  const prefix  = `loc:${user.tenant_id}:`;
  const { keys } = await c.env.SESSIONS.list({ prefix });

  const locations = (
    await Promise.all(keys.map(k => c.env.SESSIONS.get(k.name, "json")))
  ).filter(Boolean);

  return c.json({ ok: true, data: locations });
});

// ── Routes (percorsi) — stored in D1 ─────────────────────────────────────────
gps.get("/routes", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM routes WHERE tenant_id = ? ORDER BY created_at DESC")
    .bind(user.tenant_id)
    .all();
  return c.json({ ok: true, data: results.map(r => ({
    ...r,
    waypoints: JSON.parse(r.waypoints_json),
    transitSegments: JSON.parse(r.transit_segments_json || '[]'),
    showArrows: !!r.show_arrows,
  })) });
});

gps.post("/routes", rbac("gps", "edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const id   = crypto.randomUUID();
  await c.env.DB
    .prepare("INSERT INTO routes (id,tenant_id,name,color,opacity,comune,materiale,sector,giorno,waypoints_json,transit_segments_json,show_arrows) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, user.tenant_id, body.name ?? "", body.color ?? "#4ade80", body.opacity ?? 0.85,
          body.comune ?? "", body.materiale ?? "", body.sector ?? "", body.giorno ?? null,
          JSON.stringify(body.waypoints ?? []),
          JSON.stringify(body.transitSegments ?? []),
          body.showArrows ? 1 : 0)
    .run();
  return c.json({ ok: true, data: { id, ...body } }, 201);
});

gps.patch("/routes/:id", rbac("gps", "edit"), async (c) => {
  const user = c.get("user");
  const id   = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  await c.env.DB
    .prepare("UPDATE routes SET name=?,color=?,opacity=?,comune=?,materiale=?,sector=?,giorno=?,waypoints_json=?,transit_segments_json=?,show_arrows=?,updated_at=datetime('now') WHERE id=? AND tenant_id=?")
    .bind(body.name, body.color, body.opacity, body.comune, body.materiale, body.sector,
          body.giorno ?? null, JSON.stringify(body.waypoints ?? []),
          JSON.stringify(body.transitSegments ?? []),
          body.showArrows ? 1 : 0,
          id, user.tenant_id)
    .run();
  return c.json({ ok: true });
});

gps.delete("/routes/:id", rbac("gps", "edit"), async (c) => {
  const user = c.get("user");
  const id   = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM routes WHERE id=? AND tenant_id=?").bind(id, user.tenant_id).run();
  return c.json({ ok: true });
});

// ── Snap waypoints to roads via Valhalla ──────────────────────────────────────
gps.post("/routes/snap-to-roads", rbac("gps", "edit"), async (c) => {
  const { waypoints, costing = "auto" } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(waypoints) || waypoints.length < 2)
    return c.json({ ok: false, error: "Servono almeno 2 waypoint." }, 400);
  const locations = waypoints.map(([lat, lon]) => ({ lat, lon, type: "break" }));
  try {
    const data = await callValhalla(c.env, "route", {
      locations,
      costing: costing === "truck" ? "truck" : "auto",
    });
    if (!data.trip?.legs)
      return c.json({ ok: false, error: "Risposta Valhalla non valida." }, 502);
    const segments = data.trip.legs.map(leg => decodePolyline6(leg.shape));
    return c.json({ ok: true, data: { segments, unmatched: [] } });
  } catch (err) {
    if (err.name === "AbortError")
      return c.json({ ok: false, error: "Valhalla non disponibile. Avvia il server di routing." }, 503);
    return c.json({ ok: false, error: "Errore snap-to-roads." }, 500);
  }
});

// ── Turn-by-turn navigation via Valhalla ──────────────────────────────────────
gps.post("/navigate", async (c) => {
  const { from, to, costing = "auto" } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(from) || !Array.isArray(to))
    return c.json({ ok: false, error: "from e to [lat,lon] obbligatori" }, 400);
  try {
    const data = await callValhalla(c.env, "route", {
      locations: [
        { lat: from[0], lon: from[1], type: "break" },
        { lat: to[0],   lon: to[1],   type: "break" },
      ],
      costing: costing === "truck" ? "truck" : "auto",
      directions_options: { language: "it-IT", units: "km" },
    }, 15000);
    if (!data.trip?.legs?.length)
      return c.json({ ok: false, error: "Nessun percorso trovato tra questi punti." }, 502);
    const leg = data.trip.legs[0];
    const maneuvers = (leg.maneuvers || []).map(m => ({
      type: m.type, instruction: m.instruction || "",
      length: m.length || 0, time: m.time || 0,
      begin_shape_index: m.begin_shape_index, end_shape_index: m.end_shape_index,
    }));
    const summary = data.trip.summary || {};
    return c.json({ ok: true, data: {
      shape: decodePolyline6(leg.shape), maneuvers,
      distance: summary.length || 0, duration: summary.time || 0,
    }});
  } catch (err) {
    if (err.name === "AbortError")
      return c.json({ ok: false, error: "Valhalla non disponibile. Controlla la connessione." }, 503);
    return c.json({ ok: false, error: "Errore navigazione." }, 500);
  }
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
