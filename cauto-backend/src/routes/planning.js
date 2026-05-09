const express                      = require("express");
const { requireAuth, requirePerm } = require("../middleware/auth");
const jwtService                   = require("../core/auth/jwt.service");
const userRepo                     = require("../repositories/userRepository");
const gpsService                   = require("../services/gpsService");
const workshopRepo                 = require("../repositories/workshopRepository");
const planningOps                  = require("../data/planningOperators");
const planningEvs                  = require("../data/planningEvents");
const planningStream               = require("../services/planningStreamService");

// Allow up to 5 MB for event payloads (base64 photos inflate size)
const router = express.Router();
router.use(express.json({ limit: "5mb" }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapVehicleStatus(s) {
  switch ((s || "").toUpperCase()) {
    case "ACTIVE":    return "active";
    case "WORKSHOP":  return "workshop";
    case "AVAILABLE": return "available";
    default:          return "idle";
  }
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

/**
 * GET /api/planning/vehicles
 */
router.get("/vehicles", requireAuth, requirePerm("planning", "view"), async (req, res, next) => {
  try {
    const vehicles = await gpsService.getVehicles();
    const mapped = vehicles.map(v => ({
      id:     v.id,
      plate:  v.plate  || v.name || String(v.id),
      model:  v.name   || v.plate || "",
      status: mapVehicleStatus(v.status),
    }));
    res.json({ ok: true, data: mapped });
  } catch (err) {
    next(err);
  }
});

// ─── Vehicle availability (workshop conflict detection) ───────────────────────

/**
 * GET /api/planning/vehicle-availability?weekKey=YYYY-Www
 *
 * Returns workshop blocks and live GPS status per vehicle plate.
 * Used by planning.html to show conflict badges on vehicle chips.
 *
 * Response shape:
 *   { [plate]: { workshopBlocks: [{orderId, reason, status}], gpsStatus } }
 */
router.get("/vehicle-availability", requireAuth, requirePerm("planning", "view"), async (req, res, next) => {
  try {
    // Active workshop orders = anything not "done"
    const orders = workshopRepo.findAll().filter(o => o.status !== "done");

    // Live GPS statuses
    let vehicles = [];
    try { vehicles = await gpsService.getVehicles(); } catch { /* GPS offline */ }
    const gpsMap = {};
    vehicles.forEach(v => {
      if (v.plate) gpsMap[v.plate] = mapVehicleStatus(v.status);
    });

    // Build availability map keyed by plate
    const availability = {};

    for (const order of orders) {
      const plate = order.plate;
      if (!plate) continue;
      if (!availability[plate]) availability[plate] = { workshopBlocks: [], gpsStatus: null };
      availability[plate].workshopBlocks.push({
        orderId: order.id,
        reason:  order.type,
        status:  order.status,
        eta:     order.eta || null,
        notes:   order.notes || "",
      });
    }

    // Merge GPS status
    for (const [plate, gpsStatus] of Object.entries(gpsMap)) {
      if (!availability[plate]) availability[plate] = { workshopBlocks: [], gpsStatus: null };
      availability[plate].gpsStatus = gpsStatus;
    }

    res.json({ ok: true, data: availability });
  } catch (err) {
    next(err);
  }
});

// ─── Operators ────────────────────────────────────────────────────────────────

/**
 * GET /api/planning/operators
 */
router.get("/operators", requireAuth, requirePerm("planning", "view"), (req, res) => {
  const tenantId = req.tenant.id;
  res.json({ ok: true, data: planningOps.getCombinedOperators(tenantId) });
});

/**
 * PUT /api/planning/operators/:userId
 */
router.put("/operators/:userId", requireAuth, requirePerm("planning", "edit"), (req, res) => {
  const tenantId = req.tenant.id;
  const { patente, settore, workStart, workEnd, plannerEnabled } = req.body;
  const updated = planningOps.upsert(tenantId, req.params.userId, {
    patente, settore, workStart, workEnd, plannerEnabled,
  });
  if (!updated) return res.status(404).json({ ok: false, error: "Operatore non trovato o non schedulabile" });
  res.json({ ok: true, data: updated });
});

/**
 * DELETE /api/planning/operators/:userId
 */
router.delete("/operators/:userId", requireAuth, requirePerm("planning", "edit"), (req, res) => {
  planningOps.remove(req.tenant.id, req.params.userId);
  res.json({ ok: true });
});

// ─── Events ───────────────────────────────────────────────────────────────────

/**
 * GET /api/planning/events
 */
router.get("/events", requireAuth, requirePerm("planning", "view"), (req, res) => {
  res.json({ ok: true, data: planningEvs.getForTenant(req.tenant.id) });
});

/**
 * PUT /api/planning/events
 * Body: { events: [...], expectedVersion: N }
 */
router.put("/events", requireAuth, requirePerm("planning", "edit"), (req, res) => {
  const tenantId = req.tenant.id;
  const userId   = req.user.id;
  const { events, expectedVersion } = req.body;

  if (!Array.isArray(events)) {
    return res.status(400).json({ ok: false, error: "events must be an array" });
  }

  const evVersion = typeof expectedVersion === "number" ? expectedVersion : -1;
  const result    = planningEvs.replaceForTenant(tenantId, events, evVersion, userId);

  if (!result.ok) {
    const status = result.code === "VERSION_MISMATCH" ? 409 : 400;
    return res.status(status).json({
      ok:      false,
      error:   result.code,
      data:    result.current || null,
      details: result.details || null,
    });
  }

  // Broadcast to all SSE subscribers on this tenant
  planningStream.broadcast(tenantId, {
    type:    "events.updated",
    version: result.version,
    by:      userId,
    source:  "user",
  });

  res.json({ ok: true, data: { version: result.version } });
});

// ─── SSE Stream ───────────────────────────────────────────────────────────────

/**
 * GET /api/planning/stream?token=<jwt>
 *
 * Server-Sent Events endpoint for real-time planning sync.
 * EventSource cannot send custom headers, so we accept the JWT via query param.
 * HTTPS is required in production to keep the token secure.
 */
router.get("/stream", (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ ok: false, error: "Token mancante" });

  let payload;
  try {
    payload = jwtService.verify(token);
  } catch {
    return res.status(401).json({ ok: false, error: "Token non valido" });
  }

  const userId = payload.userId || payload.sub;
  const user   = userId ? userRepo.findById(userId) : null;
  if (!user || !user.active) {
    return res.status(401).json({ ok: false, error: "Sessione non valida" });
  }

  // RBAC check: planning:view
  const { getLevel, hasAccess } = require("../data/permissions");
  const level = getLevel(user.role, "planning");
  if (!hasAccess(level, "view")) {
    return res.status(403).json({ ok: false, error: "Accesso negato" });
  }

  const tenantId = payload.clientId || user.tenant_id;
  planningStream.subscribe(tenantId, res);
});

// ─── Debug: stream connection count ──────────────────────────────────────────

/**
 * GET /api/planning/stream/count  (admin only)
 */
router.get("/stream/count", requireAuth, requirePerm("planning", "view"), (req, res) => {
  res.json({
    ok:    true,
    data:  { connections: planningStream.connectionCount(req.tenant.id) },
  });
});

module.exports = router;
