/**
 * OpWatch / opsonata-worker — Hono entry point
 * Cloudflare Workers + D1 + KV backend for OpSonata
 */

import { Hono }   from "hono";
import { cors }   from "hono/cors";
import { logger } from "hono/logger";

import auth             from "./routes/auth.js";
import gps              from "./routes/gps.js";
import workshop         from "./routes/workshop.js";
import fuel             from "./routes/fuel.js";
import suppliers        from "./routes/suppliers.js";
import costs            from "./routes/costs.js";
import permissions      from "./routes/permissions.js";
import usersAdmin       from "./routes/users-admin.js";
import segnalazioni     from "./routes/segnalazioni.js";
import territorio       from "./routes/segnalazioni-territorio.js";
import reports          from "./routes/reports.js";
import planning         from "./routes/planning.js";
import upload, { serveMedia } from "./routes/upload.js";
import superadmin, { auditLogs } from "./routes/superadmin.js";
import bugs                    from "./routes/bugs.js";
import financeDepartments      from "./routes/finance-departments.js";
import financeBudgets          from "./routes/finance-budgets.js";
import { handleBudgetActualsCron } from "./cron-budget-actuals.js";
import { seedPasswords }       from "./seed.js";
import { requireAuth }         from "./middleware/auth.js";

const app = new Hono();

// ── Global middleware ─────────────────────────────────────────────────────────
app.use("*", logger());

app.use("*", async (c, next) => {
  // Production origin is always allowed. FRONTEND_URL (comma-separated) adds extras
  // (e.g. a staging URL or localhost). "credentials: true" forbids the wildcard "*".
  const extra = (c.env.FRONTEND_URL || "").split(",").map(s => s.trim()).filter(Boolean);
  const allowed = ["https://app.opsonata.com", ...extra];
  const corsHandler = cors({
    origin:         (origin) => allowed.includes(origin) ? origin : allowed[0],
    allowHeaders:   ["Authorization", "Content-Type"],
    allowMethods:   ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials:    true,
    maxAge:         86400,
  });
  return corsHandler(c, next);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok", env: c.env.ENVIRONMENT ?? "unknown", ts: new Date().toISOString() }));

// ── One-time password seeder (protected by SEED_SECRET) ───────────────────────
app.post("/api/admin/seed-passwords", async (c) => {
  const { secret } = await c.req.json().catch(() => ({}));
  if (!c.env.SEED_SECRET || secret !== c.env.SEED_SECRET)
    return c.json({ ok: false, error: "Forbidden" }, 403);
  const results = await seedPasswords(c.env);
  return c.json({ ok: true, results });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.route("/api/auth",             auth);
app.route("/api/gps",              gps);
app.route("/api/workshop",         workshop);
app.route("/api/fuel",             fuel);
app.route("/api/suppliers",        suppliers);
app.route("/api/costs",            costs);
app.route("/api/permissions",      permissions);
app.route("/api/admin/users",      usersAdmin);
app.route("/api/segnalazioni",     segnalazioni);
app.route("/api/territorio",       territorio);
app.route("/api/reports",          reports);
app.route("/api/planning",         planning);
app.route("/api/upload",           upload);
app.route("/api/superadmin",       superadmin);
app.route("/api/audit-logs",       auditLogs);
app.route("/api/bugs",             bugs);
app.route("/api/finance",          financeDepartments);
app.route("/api/finance",          financeBudgets);

// ── Public media serving from R2 (no auth — URLs are unguessable) ─────────────
app.get("/api/media/:key{[^/]+}", serveMedia);
app.get("/api/media/:key{[^/]+}/*", serveMedia);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ ok: false, error: "Route non trovata" }, 404));

// ── Global error handler ───────────────────────────────────────────────────────
app.onError((err, c) => {
  const path = new URL(c.req.url).pathname;
  console.error("[Worker error]", c.req.method, path, err.message);
  return c.json({ ok: false, error: "Errore interno del server" }, 500);
});

// ── Exports: fetch handler + cron trigger ─────────────────────────────────────
export default {
  fetch: app.fetch,

  async scheduled(event, env, _ctx) {
    console.log("[Cron] Triggered at", new Date().toISOString(), "cron:", event.cron);
    if (event.cron === "0 2 * * *") {
      await handleBudgetActualsCron(env);
    }
    // TODO Phase 2: pmScheduler(env) on "0 6 * * *"
    // TODO Phase 3: alertEngine(env) on "0 6 * * *"
  },
};
