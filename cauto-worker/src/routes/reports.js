import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const reports = new Hono();
reports.use("*", requireAuth, rbac("costs", "view"));

// Summary report: costs + fuel aggregated by month
reports.get("/summary", async (c) => {
  const user = c.get("user");

  const costs = await c.env.DB
    .prepare("SELECT * FROM monthly_costs WHERE tenant_id = ? ORDER BY month DESC LIMIT 12")
    .bind(user.tenant_id)
    .all();

  const fuelByMonth = await c.env.DB
    .prepare("SELECT strftime('%Y-%m', date) AS month, ROUND(SUM(liters),2) AS liters, ROUND(SUM(cost_eur),2) AS cost FROM fuel_entries WHERE tenant_id = ? GROUP BY month ORDER BY month DESC LIMIT 12")
    .bind(user.tenant_id)
    .all();

  const workshopByStatus = await c.env.DB
    .prepare("SELECT status, COUNT(*) AS count FROM work_orders WHERE tenant_id = ? GROUP BY status")
    .bind(user.tenant_id)
    .all();

  const segnalazioniByStatus = await c.env.DB
    .prepare("SELECT status, COUNT(*) AS count FROM segnalazioni WHERE tenant_id = ? GROUP BY status")
    .bind(user.tenant_id)
    .all();

  return c.json({
    ok: true,
    data: {
      monthly_costs:        costs.results,
      fuel_by_month:        fuelByMonth.results,
      workshop_by_status:   workshopByStatus.results,
      segnalazioni_by_status: segnalazioniByStatus.results,
    }
  });
});

export default reports;
