/**
 * Planning execution service — auto-progresses event status from GPS reality.
 *
 * Runs on a 60-second tick. For each tenant, looks at events in the current
 * and next week, cross-references assigned vehicles' GPS positions and the
 * current time slot, and transitions statuses where appropriate:
 *
 *   pianificato  → in_corso    (vehicle arrived near event location inside the time window)
 *   in_corso     → completato  (time window ended, vehicle departed)
 *
 * Only transitions events with `autoStatus: true` (default).
 * Manual planners can set `autoStatus: false` to pin a status.
 */

const gpsService      = require("./gpsService");
const planningEvs     = require("../data/planningEvents");
const planningStream  = require("./planningStreamService");
const userRepo        = require("../repositories/userRepository");

const SYSTEM_USER_ID  = "system";
const SLOT_MINUTES    = 30;

// ─── Time helpers ────────────────────────────────────────────────────────────

/**
 * Convert weekKey (YYYY-Www) and dayIndex (0=Mon…6=Sun) to a JS Date for midnight.
 */
function weekKeyAndDayToDate(weekKey, dayIndex) {
  const [year, week] = weekKey.split("-W").map(Number);
  // ISO week 1 = week containing the first Thursday of the year
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  monday.setUTCDate(monday.getUTCDate() + dayIndex);
  return monday;
}

/**
 * Return the ISO weekKey for a given Date.
 */
function dateToWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum   = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Given a startSlot (0..47), return { startMinutes, endMinutes } from midnight (UTC).
 */
function slotToMinutes(startSlot, endSlot) {
  return {
    startMinutes: startSlot * SLOT_MINUTES,
    endMinutes:   endSlot   * SLOT_MINUTES,
  };
}

// ─── Geofence helpers ────────────────────────────────────────────────────────

/**
 * Haversine distance in metres between two lat/lon points.
 */
function haversineMetres(lat1, lon1, lat2, lon2) {
  const R  = 6_371_000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Approximate lat/lon centre for Italian comuni (top operating comuni).
 * Used as a lightweight geofence without shapefile data.
 * Radius: 3 km from centre — sufficient for most Italian comuni < 30 km².
 * Extend this table as needed.
 */
const COMUNE_CENTRES = {
  "ferrara":         { lat: 44.8381, lng: 11.6197 },
  "bologna":         { lat: 44.4949, lng: 11.3426 },
  "modena":          { lat: 44.6471, lng: 10.9252 },
  "ravenna":         { lat: 44.4183, lng: 12.2035 },
  "reggio emilia":   { lat: 44.6975, lng: 10.6340 },
  "cento":           { lat: 44.7256, lng: 11.2906 },
  "argenta":         { lat: 44.6155, lng: 11.8339 },
  "comacchio":       { lat: 44.6944, lng: 12.1825 },
  "codigoro":        { lat: 44.8318, lng: 12.1011 },
  "portomaggiore":   { lat: 44.6968, lng: 11.8080 },
  "copparo":         { lat: 44.8934, lng: 11.8252 },
  "bondeno":         { lat: 44.8868, lng: 11.4160 },
  "vigarano mainarda":{ lat: 44.8289, lng: 11.4697 },
  "mirabello":       { lat: 44.8837, lng: 11.4702 },
};
const COMUNE_RADIUS_M = 3000; // 3 km

/**
 * Returns true if lat/lon is within the comune's geofence.
 * Falls back to true (assume present) when the comune is unknown — avoids
 * false negatives on comuni not in the table.
 */
function isNearComune(lat, lon, comuneName) {
  if (!lat || !lon || !comuneName) return false;
  const key = comuneName.toLowerCase().trim();
  const centre = COMUNE_CENTRES[key];
  if (!centre) return false; // unknown comune → fall back to time-based progression at call site
  return haversineMetres(lat, lon, centre.lat, centre.lng) <= COMUNE_RADIUS_M;
}

// ─── Status evaluation ───────────────────────────────────────────────────────

/**
 * Evaluate whether an event's status should auto-transition.
 *
 * @param {object} event         — planning event
 * @param {object[]} vehicles    — current GPS vehicle list
 * @param {number} nowMinutes    — minutes since midnight (UTC today)
 * @param {string} todayWeekKey  — weekKey for today
 * @param {number} todayDayIndex — day index for today (0=Mon…6=Sun)
 * @returns {{ shouldUpdate, newStatus, reason } | null}
 */
function evaluateEventStatus(event, vehicles, nowMinutes, todayWeekKey, todayDayIndex) {
  // Only auto-managed events
  if (event.autoStatus === false) return null;
  // Only events in the current day
  if (event.weekKey !== todayWeekKey || event.dayIndex !== todayDayIndex) return null;
  // Only actionable statuses
  if (event.status === "completato" || event.status === "annullato") return null;

  const { startMinutes, endMinutes } = slotToMinutes(event.startSlot, event.endSlot);

  // --- pianificato → in_corso ---
  if (event.status === "pianificato" && nowMinutes >= startMinutes && nowMinutes < endMinutes) {
    const assignedTrucks = event.trucks || [];
    if (assignedTrucks.length === 0) {
      // No trucks — time-based progression only
      return { shouldUpdate: true, newStatus: "in_corso", reason: "Avvio automatico per orario" };
    }
    // Check at least one assigned truck is near the comune
    const comune = (event.comune || "").trim();
    const truckIds = new Set(assignedTrucks.map(t => t.id));
    const nearVehicle = vehicles.find(v => truckIds.has(v.id) && isNearComune(v.lat, v.lng, comune));
    // Allow if: vehicle confirmed near comune, OR no comune set, OR comune is unknown (not in table → time-based)
    const comuneKey   = (comune || "").toLowerCase().trim();
    const comuneKnown = !!COMUNE_CENTRES[comuneKey];
    if (nearVehicle || !comune || !comuneKnown) {
      return {
        shouldUpdate: true,
        newStatus:    "in_corso",
        reason:       nearVehicle
          ? `Veicolo ${nearVehicle.plate || nearVehicle.name} rilevato in zona`
          : "Avvio automatico per orario",
      };
    }
    return null; // truck assigned but not in zone yet
  }

  // --- in_corso → completato ---
  if (event.status === "in_corso" && nowMinutes >= endMinutes) {
    return { shouldUpdate: true, newStatus: "completato", reason: "Completamento automatico per fine orario" };
  }

  return null;
}

// ─── Main tick ───────────────────────────────────────────────────────────────

async function tickAllTenants() {
  const now      = new Date();
  // Minutes since midnight UTC
  const nowMins  = now.getUTCHours() * 60 + now.getUTCMinutes();
  const todayKey = dateToWeekKey(now);
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon…6=Sun

  // Get all unique tenant IDs that have events stored
  let vehicles;
  try {
    vehicles = await gpsService.getVehicles();
  } catch (err) {
    console.warn("[PlanningExecution] GPS fetch failed:", err.message);
    return;
  }

  // Get all distinct tenant IDs from the users store
  const users = userRepo.findAll ? userRepo.findAll() : [];
  const tenantIds = [...new Set(users.map(u => u.tenant_id).filter(Boolean))];

  for (const tenantId of tenantIds) {
    try {
      const { events, version } = planningEvs.getForTenant(tenantId);
      if (!events.length) continue;

      let changed = false;
      const updated = events.map(ev => {
        const result = evaluateEventStatus(ev, vehicles, nowMins, todayKey, todayIndex);
        if (!result?.shouldUpdate) return ev;
        changed = true;
        return {
          ...ev,
          status:               result.newStatus,
          lastAutoTransitionAt: now.toISOString(),
          autoTransitionReason: result.reason,
        };
      });

      if (!changed) continue;

      const saveResult = planningEvs.replaceForTenant(tenantId, updated, version, SYSTEM_USER_ID);
      if (saveResult.ok) {
        planningStream.broadcast(tenantId, {
          type:    "events.updated",
          version: saveResult.version,
          by:      SYSTEM_USER_ID,
          source:  "auto",
        });
      }
    } catch (err) {
      console.warn(`[PlanningExecution] Tick failed for tenant ${tenantId}:`, err.message);
    }
  }
}

module.exports = { tickAllTenants, evaluateEventStatus, isNearComune, dateToWeekKey, COMUNE_CENTRES };
