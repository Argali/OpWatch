/**
 * GET /api/audit-logs
 *
 * Returns audit log entries for the caller's tenant.
 * Restricted to fleet_manager, company_admin, and superadmin.
 *
 * Query params (all optional):
 *   module    — filter by module (e.g. 'workshop')
 *   entityId  — filter by a specific record's ID
 *   action    — filter by action type ('CREATE','UPDATE','DELETE',...)
 *   limit     — max results to return (default 200, max 500)
 */

const { Router }       = require("express");
const { requireAuth }  = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/auth");
const { getAuditLogs } = require("../services/auditLogService");

const router = Router();

router.get(
  "/",
  requireAuth,
  requireAnyRole("fleet_manager", "company_admin", "superadmin"),
  (req, res, next) => {
    try {
      const clientId = req.tenant?.id || req.user?.tenant_id;
      const limit    = Math.min(parseInt(req.query.limit) || 200, 500);

      const logs = getAuditLogs(clientId, {
        module:   req.query.module   || null,
        entityId: req.query.entityId || null,
        action:   req.query.action   || null,
        limit,
      });

      res.json({ ok: true, data: logs, total: logs.length });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
