/**
 * Planning event store.
 *
 * Persisted shape (events.json):
 *   {
 *     [tenant_id]: {
 *       events:    [...],   // validated PlanningEvent array
 *       version:   42,      // incremented on every write
 *       updatedAt: ISO string,
 *       updatedBy: user id
 *     }
 *   }
 *
 * Optimistic-concurrency: callers pass expectedVersion; a mismatch returns
 * { ok: false, code: 'VERSION_MISMATCH', current: { events, version } }
 * so the client can merge and retry.
 */

const { createStore } = require("./jsonStore");
const { validateEvents } = require("../core/canonical/planningEvent");

const store = createStore("events.json", {});

function _tenantData(tenantId) {
  return store.read()[tenantId] || { events: [], version: 0, updatedAt: null, updatedBy: null };
}

/**
 * Return events + current version for a tenant.
 */
function getForTenant(tenantId) {
  const d = _tenantData(tenantId);
  return { events: d.events, version: d.version };
}

/**
 * Replace the entire events array for a tenant.
 *
 * @param {string}   tenantId
 * @param {array}    rawEvents   — unvalidated incoming array
 * @param {number}   expectedVersion — pass -1 to skip version check (initial import)
 * @param {string}   userId      — for audit
 * @returns {{ ok, version, events } | { ok:false, code, ... }}
 */
function replaceForTenant(tenantId, rawEvents, expectedVersion, userId) {
  const current = _tenantData(tenantId);

  // Optimistic concurrency check
  if (expectedVersion !== -1 && current.version !== expectedVersion) {
    return {
      ok:      false,
      code:    "VERSION_MISMATCH",
      current: { events: current.events, version: current.version },
    };
  }

  // Normalize client-side singular `truck` field → canonical `trucks` array
  const normalised = Array.isArray(rawEvents) ? rawEvents.map(ev => {
    if (!ev) return ev;
    if (ev.truck !== undefined && !Array.isArray(ev.trucks)) {
      const { truck, ...rest } = ev;
      return { ...rest, trucks: truck ? [truck] : [] };
    }
    return ev;
  }) : rawEvents;

  // Validate all events before persisting
  const validation = validateEvents(normalised);
  if (!validation.ok) {
    return {
      ok:      false,
      code:    "VALIDATION_ERROR",
      details: validation.errors,
    };
  }

  const newVersion = current.version + 1;
  const data = store.read();
  store.write({
    ...data,
    [tenantId]: {
      events:    validation.data,
      version:   newVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: userId || null,
    },
  });

  return { ok: true, version: newVersion, events: validation.data };
}

module.exports = { getForTenant, replaceForTenant };
