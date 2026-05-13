/**
 * One-time password seeder.
 * Call POST /api/admin/seed-passwords with { secret: SEED_SECRET } in body.
 * Reads SEED_*_PASSWORD env vars, hashes them, writes to D1.
 * Safe to call multiple times — skips users that already have a hash.
 */

import { hashPassword } from "./lib/crypto.js";

export async function seedPasswords(env) {
  const targets = [
    { email: env.SEED_SUPERADMIN_EMAIL ?? "superadmin@opwatch.dev", password: env.SEED_SUPERADMIN_PASSWORD },
    { email: env.SEED_OFFICINA_EMAIL   ?? "officina@cauto.it",       password: env.SEED_OFFICINA_PASSWORD   },
    { email: env.SEED_ADMIN_EMAIL      ?? "admin@cauto.it",           password: env.SEED_ADMIN_PASSWORD      },
  ];

  const results = [];
  for (const { email, password } of targets) {
    if (!password) { results.push({ email, status: "skipped — no env var" }); continue; }

    const user = await env.DB
      .prepare("SELECT id, password_hash FROM users WHERE email = ?")
      .bind(email).first();

    if (!user) { results.push({ email, status: "user not found" }); continue; }
    if (user.password_hash) { results.push({ email, status: "already set" }); continue; }

    const hash = await hashPassword(password);
    await env.DB
      .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(hash, user.id).run();

    results.push({ email, status: "hashed and saved" });
  }
  return results;
}
