/**
 * Target Cross — Parser
 *
 * Reads SpreadsheetML XML exports (Office 2003 format) produced by Target Cross
 * and returns a structured raw dataset for the cleaner → mapper pipeline.
 *
 * Vehicle source file: Exp_Lista_*.xml (Elenco Mezzi)
 *   Columns: MEZZO | VECCHIO CODICE | DESCRIZIONE | SETTORE | GESTITO DA OFFICINA
 *
 * Output shape:
 * {
 *   vehicles:    Array<{ ID_MEZZO, NOME_MEZZO, TARGA, TIPO_MEZZO, SETTORE, STATO }>,
 *   operators:   [],
 *   maintenance: [],
 * }
 *
 * Environment:
 *   TARGETCROSS_XML_PATH  — path to the Elenco Mezzi XML file (overrides auto-discovery)
 */

const fs   = require("fs");
const path = require("path");
const { parseSpreadsheetML } = require("../../utils/spreadsheet");

// Auto-discovery: look for the vehicle list in xml_exports/ at project root
const AUTO_VEHICLE_LIST = path.resolve(
  __dirname,
  "../../../../xml_exports/Exp_Lista__2026_04_03__13_29_44.xml"
);

const FIXTURE_PATH = path.resolve(
  __dirname,
  "../../tests/fixtures/targetcross/sample.json"
);

// ── Field extraction from DESCRIZIONE ────────────────────────────────────────

/**
 * Extract the license plate from the DESCRIZIONE field.
 * Handles:
 *   - Standard Italian passenger plate: XX000XX (2+3+2)
 *   - Special/machinery plate:          XXX000  (3+3)  e.g. ABR489
 * Both formats appear after "PAT.X - " in the description.
 */
function extractPlate(descrizione) {
  if (!descrizione) return "";
  // Standard Italian plate: 2 letters + 3 digits + 2 letters
  let m = descrizione.match(/([A-Z]{2}\d{3}[A-Z]{2})/);
  if (m) return m[1];
  // "TARGATO/TARGATA PLATE" format (machinery descriptions use feminine form)
  m = descrizione.match(/TARGAT[OA][:\s]+([A-Z]{2,3}\d{3,4})\b/i);
  if (m) return m[1].toUpperCase();
  // Special/machinery plate after "PAT.X -": 3 letters + 3 digits
  m = descrizione.match(/PAT\.[A-Z]\s*-\s*([A-Z]{2,3}\d{3,4})\b/i);
  if (m) return m[1].toUpperCase();
  return "";
}

/**
 * Extract vehicle body type from the DESCRIZIONE field.
 * Takes the segment before the first "/" (e.g. "COMPATTATORE 2 ASSI" from
 * "COMPATTATORE 2 ASSI IVECO/AUTOBREN PAT.C - GT801MR").
 */
function extractVehicleType(descrizione) {
  if (!descrizione) return "";
  const m = descrizione.match(/^([^/]+)\//);
  return m ? m[1].trim() : "";
}

// ── Elenco Mezzi parser ───────────────────────────────────────────────────────

/**
 * Parse the Elenco Mezzi SpreadsheetML file into raw vehicle records.
 * Normalises column names to the aliases expected by targetcross.default.json.
 */
async function parseVehicleList(filePath) {
  const rows = await parseSpreadsheetML(filePath);
  return rows
    .map(row => {
      const desc = row["DESCRIZIONE"] || "";
      return {
        ID_MEZZO:   row["MEZZO"]    || "",
        NOME_MEZZO: desc,
        TARGA:      extractPlate(desc),
        TIPO_MEZZO: extractVehicleType(desc),
        SETTORE:    row["SETTORE"]  || "",
        STATO:      "ACTIVE",
      };
    })
    .filter(r => r.ID_MEZZO !== "");
}

// ── Fixture fallback ──────────────────────────────────────────────────────────

async function parseFromFixture() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    console.warn("[TargetCross/parser] Fixture not found at", FIXTURE_PATH, "— returning empty dataset");
    return { vehicles: [], operators: [], maintenance: [] };
  }
  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  return {
    vehicles:    raw.vehicles    || [],
    operators:   raw.operators   || [],
    maintenance: raw.maintenance || [],
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Parse the TargetCross vehicle list and return a raw dataset.
 * Priority:
 *   1. TARGETCROSS_XML_PATH env var (explicit override)
 *   2. xml_exports/Exp_Lista_*.xml auto-discovery
 *   3. JSON fixture fallback (development)
 *
 * @returns {Promise<{ vehicles, operators, maintenance }>}
 */
async function parse() {
  const envPath = process.env.TARGETCROSS_XML_PATH;

  if (envPath) {
    if (!fs.existsSync(envPath)) {
      console.error("[TargetCross/parser] TARGETCROSS_XML_PATH not found:", envPath);
    } else {
      try {
        const vehicles = await parseVehicleList(envPath);
        console.info(`[TargetCross/parser] Loaded ${vehicles.length} vehicles from ${envPath}`);
        return { vehicles, operators: [], maintenance: [] };
      } catch (err) {
        console.error("[TargetCross/parser] Failed to parse", envPath, ":", err.message);
      }
    }
  }

  if (fs.existsSync(AUTO_VEHICLE_LIST)) {
    try {
      const vehicles = await parseVehicleList(AUTO_VEHICLE_LIST);
      console.info(`[TargetCross/parser] Auto-loaded ${vehicles.length} vehicles from xml_exports`);
      return { vehicles, operators: [], maintenance: [] };
    } catch (err) {
      console.error("[TargetCross/parser] Failed to auto-parse vehicle list:", err.message);
    }
  }

  return parseFromFixture();
}

module.exports = { parse };
