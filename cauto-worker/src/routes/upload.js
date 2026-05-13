/**
 * File upload route — stores files in R2, returns public URL
 *
 * POST /api/upload
 *   Body: multipart/form-data with field "file"
 *   Returns: { ok: true, url: "https://..." }
 *
 * DELETE /api/upload/:key
 *   Removes a file from R2 (admin/edit permission required)
 */

import { Hono }        from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const upload = new Hono();
upload.use("*", requireAuth);

// Allowed MIME types and their extensions
const ALLOWED_TYPES = {
  "image/jpeg":    "jpg",
  "image/jpg":     "jpg",
  "image/png":     "png",
  "image/webp":    "webp",
  "image/gif":     "gif",
  "image/heic":    "heic",
  "application/pdf": "pdf",
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file

// ── POST /api/upload ──────────────────────────────────────────────────────────
upload.post("/", async (c) => {
  const user = c.get("user");

  let formData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ ok: false, error: "Richiesta multipart non valida" }, 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string")
    return c.json({ ok: false, error: "Campo 'file' mancante" }, 400);

  // Validate type
  const mimeType = file.type || "application/octet-stream";
  const ext      = ALLOWED_TYPES[mimeType];
  if (!ext)
    return c.json({ ok: false, error: `Tipo file non supportato: ${mimeType}` }, 415);

  // Validate size
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_SIZE_BYTES)
    return c.json({ ok: false, error: "File troppo grande (max 10 MB)" }, 413);

  // Build a scoped key: tenant/userId/timestamp-random.ext
  const rand = crypto.randomUUID().split("-")[0];
  const key  = `${user.tenant_id}/${user.id}/${Date.now()}-${rand}.${ext}`;

  // Store in R2
  await c.env.MEDIA.put(key, arrayBuffer, {
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      uploadedBy: user.email,
      tenant:     user.tenant_id,
    },
  });

  // Build the public URL — served via the worker's /media/* route below
  const baseUrl = c.env.FRONTEND_URL
    ? c.env.FRONTEND_URL.replace(/\/$/, "").replace(/\/OpSonata$/, "")
    : `https://opsonata-worker.erwankervazo.workers.dev`;

  const url = `${new URL(c.req.url).origin}/api/media/${key}`;

  return c.json({ ok: true, url, key }, 201);
});

// ── GET /api/media/:key — serve file from R2 ─────────────────────────────────
// This is mounted separately in index.js (public, no auth needed for viewing)
export async function serveMedia(c) {
  const key = c.req.param("key") + (c.req.param("rest") ? "/" + c.req.param("rest") : "");

  const object = await c.env.MEDIA.get(key);
  if (!object) return c.json({ ok: false, error: "File non trovato" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}

// ── DELETE /api/upload/:key — remove from R2 ─────────────────────────────────
upload.delete("/:key{.+}", rbac("segnalazioni", "edit"), async (c) => {
  const user = c.get("user");
  const key  = c.req.param("key");

  // Enforce tenant scoping — key must start with tenant_id/
  if (!key.startsWith(`${user.tenant_id}/`))
    return c.json({ ok: false, error: "Accesso negato" }, 403);

  await c.env.MEDIA.delete(key);
  return c.json({ ok: true });
});

export default upload;
