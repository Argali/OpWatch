/**
 * Auth middleware — verifies app JWT, checks KV revocation list,
 * loads user from D1, sets c.get('user') for downstream handlers.
 */

import { verifyToken } from "../lib/jwt.js";

export async function requireAuth(c, next) {
  const header = c.req.header("Authorization") ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return c.json({ ok: false, error: "Non autenticato" }, 401);

  let payload;
  try {
    payload = await verifyToken(token, c.env);
  } catch {
    return c.json({ ok: false, error: "Token non valido o scaduto" }, 401);
  }

  // Check KV revocation list (logout invalidates the jti)
  const revoked = await c.env.SESSIONS.get(`revoked:${payload.jti}`);
  if (revoked) return c.json({ ok: false, error: "Sessione terminata" }, 401);

  // Load fresh user from D1
  const user = await c.env.DB
    .prepare("SELECT * FROM users WHERE id = ? AND active = 1")
    .bind(payload.userId)
    .first();

  if (!user) return c.json({ ok: false, error: "Utente non trovato" }, 401);

  c.set("user",  user);
  c.set("token", payload);
  await next();
}
