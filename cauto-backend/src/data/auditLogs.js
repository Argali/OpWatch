/**
 * Audit log store — persists to disk using the same jsonStore pattern
 * as planningEvents.js. Data directory resolves from PLANNING_DATA_DIR.
 */

const { createStore } = require("./jsonStore");

// Separate file from planning data, same directory
const auditLogStore = createStore("auditLogs.json", []);

module.exports = auditLogStore;
