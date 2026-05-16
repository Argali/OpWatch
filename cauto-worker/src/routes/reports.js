import { Hono }       from "hono";
import { requireAuth } from "../middleware/auth.js";
import { rbac }        from "../middleware/rbac.js";

const reports = new Hono();
reports.use("*", requireAuth, rbac("costs", "view"));

// ── CSV helpers ───────────────────────────────────────────────────────────────
function escapeCell(v) {
  const s = v == null ? "" : String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function toCSV(cols, rows) {
  const header = cols.map(c => escapeCell(c.label)).join(",");
  const body   = rows.map(r => cols.map(c => escapeCell(r[c.key])).join(",")).join("\r\n");
  return `${header}\r\n${body}`;
}

function dateStr() {
  return new Date().toISOString().slice(0, 10);
}

function csvResponse(text, filename) {
  return new Response("﻿" + text, {   // BOM so Excel opens UTF-8 correctly
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ── JSON summary (dashboard cards) ───────────────────────────────────────────
reports.get("/summary", async (c) => {
  const user = c.get("user");

  const [costs, fuelByMonth, workshopByStatus, segnalazioniByStatus] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM monthly_costs WHERE tenant_id = ? ORDER BY month DESC LIMIT 12").bind(user.tenant_id).all(),
    c.env.DB.prepare("SELECT strftime('%Y-%m', date) AS month, ROUND(SUM(liters),2) AS liters, ROUND(SUM(cost_eur),2) AS cost FROM fuel_entries WHERE tenant_id = ? GROUP BY month ORDER BY month DESC LIMIT 12").bind(user.tenant_id).all(),
    c.env.DB.prepare("SELECT status, COUNT(*) AS count FROM work_orders WHERE tenant_id = ? GROUP BY status").bind(user.tenant_id).all(),
    c.env.DB.prepare("SELECT status, COUNT(*) AS count FROM segnalazioni WHERE tenant_id = ? GROUP BY status").bind(user.tenant_id).all(),
  ]);

  return c.json({
    ok: true,
    data: {
      monthly_costs:          costs.results,
      fuel_by_month:          fuelByMonth.results,
      workshop_by_status:     workshopByStatus.results,
      segnalazioni_by_status: segnalazioniByStatus.results,
    },
  });
});

// ── Segnalazioni CSV ──────────────────────────────────────────────────────────
reports.get("/segnalazioni", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM segnalazioni WHERE tenant_id = ? ORDER BY created_at DESC")
    .bind(user.tenant_id).all();

  return csvResponse(toCSV([
    { key: "created_at",  label: "Data"       },
    { key: "vehicle",     label: "Veicolo"    },
    { key: "plate",       label: "Targa"      },
    { key: "tipo",        label: "Tipo"       },
    { key: "description", label: "Descrizione"},
    { key: "reported_by", label: "Segnalante" },
    { key: "status",      label: "Stato"      },
    { key: "ponte",       label: "Ponte"      },
  ], results), `segnalazioni_${dateStr()}.csv`);
});

// ── Carburante CSV ────────────────────────────────────────────────────────────
reports.get("/fuel", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM fuel_entries WHERE tenant_id = ? ORDER BY date DESC")
    .bind(user.tenant_id).all();

  return csvResponse(toCSV([
    { key: "date",     label: "Data"     },
    { key: "vehicle",  label: "Veicolo"  },
    { key: "plate",    label: "Targa"    },
    { key: "liters",   label: "Litri"    },
    { key: "cost_eur", label: "Costo €"  },
    { key: "km",       label: "KM"       },
    { key: "station",  label: "Stazione" },
  ], results), `carburante_${dateStr()}.csv`);
});

// ── Officina CSV ──────────────────────────────────────────────────────────────
reports.get("/workshop", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB
    .prepare("SELECT * FROM work_orders WHERE tenant_id = ? ORDER BY opened_at DESC")
    .bind(user.tenant_id).all();

  return csvResponse(toCSV([
    { key: "vehicle",     label: "Veicolo"   },
    { key: "plate",       label: "Targa"     },
    { key: "tipo",        label: "Tipo"      },
    { key: "description", label: "Problema"  },
    { key: "status",      label: "Stato"     },
    { key: "priority",    label: "Priorità"  },
    { key: "cost_eur",    label: "Costo €"   },
    { key: "mileage_km",  label: "KM"        },
    { key: "opened_at",   label: "Aperto il" },
    { key: "closed_at",   label: "Chiuso il" },
  ], results), `officina_${dateStr()}.csv`);
});

// ── Report completo flotta (3 sections in one file) ───────────────────────────
reports.get("/fleet", async (c) => {
  const user = c.get("user");

  const [fuel, orders, segs] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM fuel_entries WHERE tenant_id = ? ORDER BY date DESC").bind(user.tenant_id).all(),
    c.env.DB.prepare("SELECT * FROM work_orders  WHERE tenant_id = ? ORDER BY opened_at DESC").bind(user.tenant_id).all(),
    c.env.DB.prepare("SELECT * FROM segnalazioni WHERE tenant_id = ? ORDER BY created_at DESC").bind(user.tenant_id).all(),
  ]);

  const fuelCSV = toCSV([
    { key: "date",     label: "Data"     }, { key: "vehicle",  label: "Veicolo"  },
    { key: "plate",    label: "Targa"    }, { key: "liters",   label: "Litri"    },
    { key: "cost_eur", label: "Costo €"  }, { key: "km",       label: "KM"       },
    { key: "station",  label: "Stazione" },
  ], fuel.results);

  const ordersCSV = toCSV([
    { key: "vehicle",   label: "Veicolo"   }, { key: "plate",    label: "Targa"     },
    { key: "tipo",      label: "Tipo"      }, { key: "status",   label: "Stato"     },
    { key: "cost_eur",  label: "Costo €"   }, { key: "opened_at",label: "Aperto il" },
    { key: "closed_at", label: "Chiuso il" },
  ], orders.results);

  const segsCSV = toCSV([
    { key: "created_at",  label: "Data"        }, { key: "vehicle",     label: "Veicolo"    },
    { key: "plate",       label: "Targa"       }, { key: "tipo",        label: "Tipo"       },
    { key: "description", label: "Descrizione" }, { key: "status",      label: "Stato"      },
  ], segs.results);

  const combined =
    `### CARBURANTE ###\r\n${fuelCSV}\r\n\r\n` +
    `### OFFICINA ###\r\n${ordersCSV}\r\n\r\n` +
    `### SEGNALAZIONI ###\r\n${segsCSV}`;

  return csvResponse(combined, `report_flotta_${dateStr()}.csv`);
});

export default reports;
