/**
 * Auth routes
 * POST /api/auth/login        — local email/password
 * POST /api/auth/azure        — Azure AD token exchange
 * GET  /api/auth/me           — current user
 * POST /api/auth/logout       — invalidate session in KV
 */

import { Hono }                      from "hono";
import { verifyPassword }            from "../lib/crypto.js";
import { signToken, verifyAzureToken } from "../lib/jwt.js";
import { requireAuth }               from "../middleware/auth.js";

const auth = new Hono();

// ── Local login ───────────────────────────────────────────────────────────────
auth.post("/login", async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  if (!email || !password)
    return c.json({ ok: false, error: "Email e password richiesti" }, 400);

  const user = await c.env.DB
    .prepare("SELECT * FROM users WHERE email = ? AND active = 1 AND auth_provider = 'local'")
    .bind(email.toLowerCase().trim())
    .first();

  if (!user || !user.password_hash)
    return c.json({ ok: false, error: "Credenziali non valide" }, 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid)
    return c.json({ ok: false, error: "Credenziali non valide" }, 401);

  const token = await signToken(
    { userId: user.id, email: user.email, role: user.role, tenantId: user.tenant_id },
    c.env
  );

  return c.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenant_id } });
});

// ── Azure AD token exchange ───────────────────────────────────────────────────
auth.post("/azure", async (c) => {
  const { azureToken } = await c.req.json().catch(() => ({}));
  if (!azureToken)
    return c.json({ ok: false, error: "Azure token mancante" }, 400);

  let azurePayload;
  try {
    azurePayload = await verifyAzureToken(azureToken, c.env);
  } catch {
    return c.json({ ok: false, error: "Token Azure non valido" }, 401);
  }

  const email = azurePayload.preferred_username || azurePayload.email || azurePayload.upn;
  if (!email)
    return c.json({ ok: false, error: "Email non trovata nel token Azure" }, 401);

  const user = await c.env.DB
    .prepare("SELECT * FROM users WHERE email = ? AND active = 1 AND auth_provider = 'azure'")
    .bind(email.toLowerCase().trim())
    .first();

  if (!user)
    return c.json({ ok: false, error: "Utente non autorizzato" }, 403);

  const token = await signToken(
    { userId: user.id, email: user.email, role: user.role, tenantId: user.tenant_id },
    c.env
  );

  return c.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenant_id } });
});

// ── Current user ──────────────────────────────────────────────────────────────
auth.get("/me", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenant_id } });
});

// ── Logout ────────────────────────────────────────────────────────────────────
auth.post("/logout", requireAuth, async (c) => {
  const token = c.get("token");
  if (token?.jti) {
    const ttl = Math.max(1, (token.exp ?? 0) - Math.floor(Date.now() / 1000));
    await c.env.SESSIONS.put(`revoked:${token.jti}`, "1", { expirationTtl: ttl });
  }
  return c.json({ ok: true });
});

export default auth;
