/**
 * Planning operator store.
 *
 * OpWatch users are identity source-of-truth (users.js).
 * This sidecar adds planning-specific metadata per user per tenant:
 *   patente, settore, workStart, workEnd, plannerEnabled
 *
 * Persisted shape (operators.json):
 *   {
 *     [tenant_id]: {
 *       [user_id]: { patente, settore, workStart, workEnd, plannerEnabled }
 *     }
 *   }
 *
 * getCombinedOperators(tenantId) merges users + sidecar to produce planning-shaped objects.
 */

const userRepo  = require("../repositories/userRepository");
const { createStore } = require("./jsonStore");

const store = createStore("operators.json", {});

// Roles that are assignable as planning operators
const SCHEDULABLE_ROLES = new Set([
  "fleet_manager",
  "responsabile_officina",
  "coordinatore_officina",
  "coordinatore_operativo",
]);

/**
 * Return combined operator objects for a tenant.
 * Only users with SCHEDULABLE_ROLES and plannerEnabled !== false are included
 * (unless the sidecar explicitly sets plannerEnabled: false to exclude someone).
 */
function getCombinedOperators(tenantId) {
  const all    = userRepo.findAll ? userRepo.findAll() : [];
  const sidecars = store.read()[tenantId] || {};

  return all
    .filter(u => u.tenant_id === tenantId && u.active && SCHEDULABLE_ROLES.has(u.role))
    .map(u => {
      const meta = sidecars[u.id] || {};
      // Respect plannerEnabled: false to exclude a user from planning
      if (meta.plannerEnabled === false) return null;
      return {
        id:        u.id,
        name:      u.name,
        role:      u.role,
        status:    u.active ? "active" : "idle",
        patente:   meta.patente   ?? "",
        settore:   meta.settore   ?? "",
        workStart: meta.workStart ?? "08:00",
        workEnd:   meta.workEnd   ?? "17:00",
      };
    })
    .filter(Boolean);
}

/**
 * Upsert planning metadata for a user.
 * Returns the combined operator object, or null if the user doesn't exist / isn't schedulable.
 */
function upsert(tenantId, userId, meta) {
  const all     = userRepo.findAll ? userRepo.findAll() : [];
  const user    = all.find(u => u.id === userId && u.tenant_id === tenantId);
  if (!user || !SCHEDULABLE_ROLES.has(user.role)) return null;

  const data = store.read();
  const tenantData = { ...data[tenantId] || {} };
  tenantData[userId] = {
    ...(tenantData[userId] || {}),
    patente:       meta.patente       ?? tenantData[userId]?.patente   ?? "",
    settore:       meta.settore       ?? tenantData[userId]?.settore   ?? "",
    workStart:     meta.workStart     ?? tenantData[userId]?.workStart ?? "08:00",
    workEnd:       meta.workEnd       ?? tenantData[userId]?.workEnd   ?? "17:00",
    plannerEnabled: meta.plannerEnabled !== undefined
      ? meta.plannerEnabled
      : (tenantData[userId]?.plannerEnabled ?? true),
  };
  store.write({ ...data, [tenantId]: tenantData });

  return getCombinedOperators(tenantId).find(op => op.id === userId) || null;
}

/**
 * Mark a user as not plannerEnabled (soft delete from planning pool).
 */
function remove(tenantId, userId) {
  const data = store.read();
  const tenantData = { ...data[tenantId] || {} };
  tenantData[userId] = { ...(tenantData[userId] || {}), plannerEnabled: false };
  store.write({ ...data, [tenantId]: tenantData });
}

module.exports = { getCombinedOperators, upsert, remove };
