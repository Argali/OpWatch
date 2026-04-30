/**
 * XML data loader — reads TargetCross SpreadsheetML exports from xml_exports/
 * and populates an in-memory cache used by fuelRepository and costRepository.
 *
 * Call load() once at startup (awaited before server.listen).
 * Repositories call the getter functions which return cached data synchronously.
 *
 * Files consumed (from xml_exports/ at project root):
 *   consumi_YEAR.xml          → liters per vehicle per month
 *   costo_carburante_YEAR.xml → fuel cost per vehicle per month
 *   costi_officina_YEAR.xml   → workshop cost per vehicle per month
 *   svecchiamento_mezzi.xml   → vehicle registration date, euro category, replacement forecast
 */

const fs   = require("fs");
const path = require("path");
const { parseSpreadsheetML } = require("../utils/spreadsheet");

const XML_DIR = path.resolve(__dirname, "../../../xml_exports");

// ── In-memory cache ───────────────────────────────────────────────────────────
let _fuelEntries  = null;
let _fuelSummary  = null;
let _monthlyCosts = null;
let _vehicleMeta  = null;

// ── File discovery ────────────────────────────────────────────────────────────

function findFiles(pattern) {
  if (!fs.existsSync(XML_DIR)) return [];
  return fs.readdirSync(XML_DIR)
    .filter(f => pattern.test(f))
    .map(f => path.join(XML_DIR, f))
    .sort();
}

// ── Column helpers ────────────────────────────────────────────────────────────

/**
 * Convert a monthly column name to a "YYYY-MM" key.
 * Handles: V202401, V202412
 */
function colToMonth(col) {
  const m = col.match(/^V(\d{4})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Parse a monthly-keyed SpreadsheetML file.
 * Returns array of { plate, cod_art, settore, months: {"YYYY-MM": number}, total }.
 */
async function parseMonthlyFile(filePath, totalCol) {
  let rows;
  try {
    rows = await parseSpreadsheetML(filePath);
  } catch (err) {
    console.warn(`[XmlLoader] Skipping ${path.basename(filePath)}: ${err.message}`);
    return [];
  }

  return rows.map(row => {
    const months = {};
    for (const [col, val] of Object.entries(row)) {
      const month = colToMonth(col);
      if (month !== null) months[month] = parseFloat(val) || 0;
    }
    return {
      plate:   (row["TARGA"]      || row["AUTOM"]  || "").trim(),
      cod_art: (row["COD_ART"]    || row["AUTOM"]  || "").trim(),
      settore: (row["ID_SETTORE"] || "").trim(),
      months,
      total: parseFloat(row[totalCol]) || 0,
    };
  }).filter(r => r.plate || r.cod_art);
}

// ── Main loader ───────────────────────────────────────────────────────────────

async function load() {
  // ── Fuel liters (annual files only — skip quarterly consumi_TX_YEAR.xml) ──
  const consumiFiles    = findFiles(/^consumi_\d{4}\.xml$/i);
  const consumiRows     = [];
  for (const f of consumiFiles)
    consumiRows.push(...await parseMonthlyFile(f, "TOTALE_LITRI"));

  // ── Fuel cost ─────────────────────────────────────────────────────────────
  const carburanteFiles = findFiles(/^costo_carburante_\d{4}\.xml$/i);
  const carburanteRows  = [];
  for (const f of carburanteFiles)
    carburanteRows.push(...await parseMonthlyFile(f, "TOTALE_CARBURANTE"));

  // ── Workshop cost ─────────────────────────────────────────────────────────
  const officinaFiles   = findFiles(/^costi_officina_\d{4}\.xml$/i);
  const officinaRows    = [];
  for (const f of officinaFiles)
    officinaRows.push(...await parseMonthlyFile(f, "TOTALE_OFFICINA"));

  // ── Build per-plate, per-month cost lookup ────────────────────────────────
  const fuelCostByKey = {};   // "PLATE|YYYY-MM" → €
  for (const row of carburanteRows) {
    for (const [month, cost] of Object.entries(row.months)) {
      if (cost <= 0) continue;
      const key = `${row.plate}|${month}`;
      fuelCostByKey[key] = (fuelCostByKey[key] || 0) + cost;
    }
  }

  // ── Fuel entries: one record per vehicle per month ────────────────────────
  const entries = [];
  for (const row of consumiRows) {
    for (const [month, liters] of Object.entries(row.months)) {
      if (liters <= 0) continue;
      const cost = fuelCostByKey[`${row.plate}|${month}`] ?? null;
      entries.push({
        date:     `${month}-01`,
        vehicle:  row.plate,
        liters:   Math.round(liters * 100) / 100,
        cost_eur: cost != null ? cost.toFixed(2) : null,
        km:       null,
        station:  null,
      });
    }
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));
  _fuelEntries = entries;

  // ── Fuel summary ──────────────────────────────────────────────────────────
  const totalLiters = entries.reduce((s, e) => s + e.liters, 0);
  const totalCost   = entries.reduce((s, e) => s + (parseFloat(e.cost_eur) || 0), 0);
  _fuelSummary = {
    total_liters:         Math.round(totalLiters * 100) / 100,
    total_cost_eur:       Math.round(totalCost   * 100) / 100,
    total_km:             null,
    avg_consumption_l100: null,
  };

  // ── Monthly cost aggregation ──────────────────────────────────────────────
  const fuelByMonth   = {};
  for (const row of carburanteRows)
    for (const [month, v] of Object.entries(row.months))
      fuelByMonth[month] = (fuelByMonth[month] || 0) + v;

  const officByMonth  = {};
  for (const row of officinaRows)
    for (const [month, v] of Object.entries(row.months))
      officByMonth[month] = (officByMonth[month] || 0) + v;

  const allMonths = new Set([...Object.keys(fuelByMonth), ...Object.keys(officByMonth)]);
  _monthlyCosts = [...allMonths].sort().map(month => {
    const fuel        = Math.round((fuelByMonth[month]  || 0) * 100) / 100;
    const maintenance = Math.round((officByMonth[month] || 0) * 100) / 100;
    return { month, fuel, maintenance, other: 0, total: Math.round((fuel + maintenance) * 100) / 100 };
  });

  // ── Vehicle metadata (svecchiamento_mezzi.xml) ────────────────────────────
  _vehicleMeta = {};
  const svecFiles = findFiles(/^svecchiamento_mezzi\.xml$/i);
  if (svecFiles.length) {
    try {
      const rows = await parseSpreadsheetML(svecFiles[0]);
      for (const row of rows) {
        const plate = (row["TARGA"] || "").trim();
        if (!plate) continue;
        _vehicleMeta[plate] = {
          registration_date: row["DATA_IMMATRICOLAZIONE"]?.split("T")[0] || null,
          euro_category:     row["CATEGORIA_EURO"]?.trim()                || null,
          km_lifetime:       parseFloat(row["KM_ORE_VITA"])               || null,
          replacement_due:   row["PREVISIONE_DATA_CONSIGLIO"]?.split("T")[0] || null,
        };
      }
    } catch (err) {
      console.warn("[XmlLoader] svecchiamento_mezzi parse failed:", err.message);
    }
  }

  console.info(
    `[XmlLoader] Loaded: ${_fuelEntries.length} fuel entries | ` +
    `${_monthlyCosts.length} monthly cost rows | ` +
    `${Object.keys(_vehicleMeta).length} vehicle meta records`
  );
}

// ── Public getters (synchronous after load()) ─────────────────────────────────

const fuelEntries  = () => _fuelEntries  || [];
const fuelSummary  = () => _fuelSummary  || null;
const monthlyCosts = () => _monthlyCosts || [];
const vehicleMeta  = () => _vehicleMeta  || {};

module.exports = { load, fuelEntries, fuelSummary, monthlyCosts, vehicleMeta };
