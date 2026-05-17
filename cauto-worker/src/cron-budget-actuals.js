/**
 * OpsFinance — Nightly Budget Actuals Cron
 *
 * Runs at 02:00 UTC every night (see wrangler.toml).
 * Aggregates fuel, maintenance, and operations costs per sector
 * into budget_actuals for the current and previous calendar month.
 *
 * Sources:
 *   fuel_entries        → fuel_total         (joined via vehicles.sector_id)
 *   work_orders (chiuso) → maintenance_total  (joined via vehicle name + org)
 *   planning_events     → operations_total    (joined via sector_id directly)
 */

export async function handleBudgetActualsCron(env) {
  const db = env.DB;
  const now = new Date();
  const periods = [currentPeriod(now), previousPeriod(now)];

  const { results: tenants } = await db
    .prepare("SELECT id FROM tenants WHERE active = 1 OR active IS NULL")
    .all();

  console.log(`[BudgetActuals] Processing ${tenants.length} tenant(s), periods:`, periods);

  for (const tenant of tenants) {
    for (const period of periods) {
      try {
        await computeAndUpsert(db, tenant.id, period.year, period.month);
      } catch (err) {
        console.error(`[BudgetActuals] Error tenant=${tenant.id} ${period.year}-${period.month}:`, err.message);
      }
    }
  }

  console.log("[BudgetActuals] Cron complete.");
}

async function computeAndUpsert(db, tenantId, year, month) {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd   = lastDayOfMonth(year, month);

  // ── Fuel: sum cost_eur per sector via vehicles.sector_id FK ──────────────────
  const { results: fuelRows } = await db.prepare(`
    SELECT v.sector_id, COALESCE(SUM(f.cost_eur), 0) AS fuel_total
    FROM fuel_entries f
    JOIN vehicles v ON v.id = f.vehicle_id
    WHERE f.tenant_id = ?
      AND f.date >= ? AND f.date <= ?
      AND v.sector_id IS NOT NULL
    GROUP BY v.sector_id
  `).bind(tenantId, monthStart, monthEnd).all();

  // ── Maintenance: closed work orders, join vehicle by name + org ───────────────
  const { results: maintenanceRows } = await db.prepare(`
    SELECT v.sector_id, COALESCE(SUM(wo.cost_eur), 0) AS maintenance_total
    FROM work_orders wo
    JOIN vehicles v
      ON v.name = wo.vehicle
     AND v.organization_id = wo.tenant_id
    WHERE wo.tenant_id = ?
      AND wo.status = 'chiuso'
      AND wo.closed_at >= ? AND wo.closed_at <= ?
      AND v.sector_id IS NOT NULL
    GROUP BY v.sector_id
  `).bind(tenantId, monthStart, monthEnd).all();

  // ── Operations: completed planning events with a sector_id ────────────────────
  const { results: opsRows } = await db.prepare(`
    SELECT sector_id, COALESCE(SUM(actual_cost), 0) AS operations_total
    FROM planning_events
    WHERE tenant_id = ?
      AND status = 'completato'
      AND sector_id IS NOT NULL
      AND completed_at >= ? AND completed_at <= ?
    GROUP BY sector_id
  `).bind(tenantId, monthStart, monthEnd).all();

  const merged     = mergeBySector({ fuelRows, maintenanceRows, opsRows });
  const computedAt = new Date().toISOString();

  for (const [sectorId, totals] of Object.entries(merged)) {
    const id = `${tenantId}__${sectorId}__${year}__${month}`;
    await db.prepare(`
      INSERT INTO budget_actuals
        (id, tenant_id, sector_id, year, month,
         fuel_total, maintenance_total, operations_total, computed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, sector_id, year, month) DO UPDATE SET
        fuel_total        = excluded.fuel_total,
        maintenance_total = excluded.maintenance_total,
        operations_total  = excluded.operations_total,
        computed_at       = excluded.computed_at
    `).bind(
      id, tenantId, sectorId, year, month,
      totals.fuel_total, totals.maintenance_total,
      totals.operations_total, computedAt,
    ).run();
  }

  console.log(`[BudgetActuals] tenant=${tenantId} ${year}-${month}: ${Object.keys(merged).length} sector(s) upserted`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentPeriod(date) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function previousPeriod(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function lastDayOfMonth(year, month) {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10) + " 23:59:59";
}

function mergeBySector({ fuelRows, maintenanceRows, opsRows }) {
  const map = {};
  const ensure = (id) => {
    if (!map[id]) map[id] = { fuel_total: 0, maintenance_total: 0, operations_total: 0 };
  };
  for (const r of fuelRows)        { ensure(r.sector_id); map[r.sector_id].fuel_total        = r.fuel_total; }
  for (const r of maintenanceRows) { ensure(r.sector_id); map[r.sector_id].maintenance_total = r.maintenance_total; }
  for (const r of opsRows)         { ensure(r.sector_id); map[r.sector_id].operations_total  = r.operations_total; }
  return map;
}
