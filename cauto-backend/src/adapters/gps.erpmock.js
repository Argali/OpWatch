/**
 * ERP-seeded mock GPS adapter
 *
 * Reads the real vehicle list from the ERP connector (Elenco Mezzi XML) and
 * assigns simulated positions around Ferrara so the map shows actual Cauto
 * trucks instead of placeholder names.
 *
 * Use while VisiRun IP registration is pending:
 *   GPS_PROVIDER=erpmock
 *
 * Switch to live data once the server IP is registered:
 *   GPS_PROVIDER=visirun
 *
 * Positions are deterministic per vehicle (seeded by vehicle code) so trucks
 * don't jump around on every restart.
 */

const erpAdapter = require("./erp");

// Brescia bounding box (approximate service area)
const LAT_MIN = 45.480, LAT_MAX = 45.590;
const LNG_MIN = 10.150, LNG_MAX = 10.300;

// Statuses to cycle through for variety
const STATUSES = ["active", "active", "active", "idle", "idle", "workshop"];

/**
 * Deterministic pseudo-random number in [0, 1) seeded by a string.
 * Uses a simple hash so each vehicle always gets the same base position.
 */
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0;
  return ((h >>> 0) / 0xFFFFFFFF);
}

function seededRandom2(seed) {
  return seededRandom(seed + "_2");
}

let routes     = [];
let nextRouteId = 1;

module.exports = {
  async getVehicles() {
    const erpVehicles = erpAdapter.getVehicles("cauto");

    return erpVehicles
      .filter(v => v.license_plate) // skip plate-less entries (fuel tanks etc.)
      .map(v => {
        const r1 = seededRandom(v.external_id);
        const r2 = seededRandom2(v.external_id);
        const statusIdx = Math.floor(r1 * STATUSES.length);
        const status    = STATUSES[statusIdx];
        const lat       = LAT_MIN + r1 * (LAT_MAX - LAT_MIN);
        const lng       = LNG_MIN + r2 * (LNG_MAX - LNG_MIN);
        const speed     = status === "active" ? Math.round(r2 * 60) : 0;

        return {
          id:        v.external_id,
          name:      v.license_plate,          // plate as display name (matches VisiRun behaviour)
          plate:     v.license_plate,
          status,
          speed_kmh: speed,
          fuel_pct:  null,
          sector:    v.vehicle_type || "IGUAO",
          lat,
          lng,
          last_seen: new Date().toISOString(),
        };
      });
  },

  async getHistory()  { return { waypoints: [], summary: {} }; },
  async getStops()    { return []; },
  async getKpi()      { return []; },
  async getOdometer() { return []; },

  async getRoutes()            { return routes; },
  async createRoute(data)      { const r = { id: `r${nextRouteId++}`, ...data }; routes = [...routes, r]; return r; },
  async updateRoute(id, data)  {
    const idx = routes.findIndex(r => r.id === id);
    if (idx === -1) return null;
    const updated = { ...routes[idx], ...data };
    routes = routes.map(r => r.id === id ? updated : r);
    return updated;
  },
  async deleteRoute(id) {
    const exists = routes.some(r => r.id === id);
    if (!exists) return false;
    routes = routes.filter(r => r.id !== id);
    return true;
  },
};
