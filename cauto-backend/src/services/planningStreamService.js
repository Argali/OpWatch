/**
 * Server-Sent Events (SSE) service for real-time planning sync.
 *
 * Maintains an in-memory map of { tenantId → Set<res> } where res is an
 * Express response object with SSE headers already set.
 *
 * Usage:
 *   // In route: subscribe a client
 *   planningStream.subscribe(tenantId, res);
 *
 *   // After a write: push update to all clients on that tenant
 *   planningStream.broadcast(tenantId, { type: 'events.updated', version: 43 });
 */

const subscribers = new Map(); // tenantId → Set<res>

// Heartbeat every 25s — defeats proxy / load-balancer idle timeouts
const HEARTBEAT_INTERVAL = 25_000;
let heartbeatTimer = null;

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const [, clients] of subscribers) {
      for (const res of clients) {
        try { res.write(": ping\n\n"); } catch { /* client already gone */ }
      }
    }
  }, HEARTBEAT_INTERVAL);
  // Don't prevent process exit
  if (heartbeatTimer.unref) heartbeatTimer.unref();
}

/**
 * Subscribe an SSE response to a tenant's event stream.
 * Sets the required SSE headers and registers a close listener to clean up.
 */
function subscribe(tenantId, res) {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Send an immediate "connected" event so the client knows the stream is live
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  if (!subscribers.has(tenantId)) subscribers.set(tenantId, new Set());
  subscribers.get(tenantId).add(res);

  res.on("close", () => {
    const clients = subscribers.get(tenantId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) subscribers.delete(tenantId);
    }
  });

  startHeartbeat();
}

/**
 * Push an event to all SSE clients subscribed to a tenant.
 * @param {string} tenantId
 * @param {object} payload — will be JSON-serialised as the SSE data field
 */
function broadcast(tenantId, payload) {
  const clients = subscribers.get(tenantId);
  if (!clients || clients.size === 0) return;

  const message = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(message);
    } catch {
      // Dead connection — will be cleaned up on 'close' event
    }
  }
}

/** How many clients are currently connected for a tenant. */
function connectionCount(tenantId) {
  return subscribers.get(tenantId)?.size ?? 0;
}

module.exports = { subscribe, broadcast, connectionCount };
