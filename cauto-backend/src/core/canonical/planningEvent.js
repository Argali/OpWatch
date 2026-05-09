/**
 * Canonical PlanningEvent schema.
 *
 * Mirrors the shape used by planning.html's localStorage events array.
 * Validates payloads before they enter the server-side event store.
 */

const { z } = require("zod");

const OperatorRefSchema = z.object({
  id:   z.string().min(1),
  name: z.string().optional(),
  role: z.string().optional(),
});

const TruckRefSchema = z.object({
  id:    z.string().min(1),
  plate: z.string().optional(),
  model: z.string().optional(),
});

const PlanningEventSchema = z.object({
  id:               z.string().min(1),
  title:            z.string().min(1),
  weekKey:          z.string().regex(/^\d{4}-W\d{2}$/, "weekKey must be YYYY-Www"),
  dayIndex:         z.number().int().min(0).max(6),
  startSlot:        z.number().int().min(0).max(47),
  endSlot:          z.number().int().min(1).max(48),
  cat:              z.string().default("altro"),
  status:           z.enum(["pianificato", "in_corso", "completato", "annullato"]).default("pianificato"),
  operators:        z.array(OperatorRefSchema).default([]),
  trucks:           z.array(TruckRefSchema).default([]),
  clientId:         z.string().optional().nullable(),
  comune:           z.string().optional().default(""),
  recurrenceGroupId:z.string().optional().nullable(),
  note:             z.string().optional().default(""),
  odometer:         z.string().optional().default(""),
  actualCost:       z.union([z.string(), z.number()]).optional().nullable(),
  // Photos stored as base64 data URIs — allow up to 3 per event (validated by client, not here)
  photos:           z.array(z.string()).max(3).optional().default([]),
  // Single truck ref (planning.html uses a singular field; trucks[] is the canonical server form)
  // We accept both: `truck` (singular) is normalised to `trucks` on ingest
  truck:            z.object({ id: z.string().min(1), plate: z.string().optional(), model: z.string().optional() }).optional().nullable(),
  // Completion timestamp (set when status transitions to completato)
  completedAt:      z.string().optional().nullable(),
  // Auto-status GPS control — when false the execution service skips this event
  autoStatus:            z.boolean().default(true),
  lastAutoTransitionAt:  z.string().optional().nullable(),
  autoTransitionReason:  z.string().optional().nullable(),
});

/**
 * Validate a single event. Returns { ok, data } or { ok: false, errors }.
 */
function validateEvent(raw) {
  const result = PlanningEventSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok:     false,
    errors: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`),
  };
}

/**
 * Validate an array of events. Returns { ok, data, errors } where errors
 * is an array of { index, eventId, errors } for any invalid events.
 */
function validateEvents(rawArray) {
  if (!Array.isArray(rawArray)) {
    return { ok: false, errors: [{ index: -1, message: "events must be an array" }] };
  }
  const validated = [];
  const errors    = [];

  for (let i = 0; i < rawArray.length; i++) {
    const result = PlanningEventSchema.safeParse(rawArray[i]);
    if (result.success) {
      validated.push(result.data);
    } else {
      errors.push({
        index:   i,
        eventId: rawArray[i]?.id || null,
        errors:  result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`),
      });
    }
  }

  return { ok: errors.length === 0, data: validated, errors };
}

module.exports = { PlanningEventSchema, validateEvent, validateEvents };
