/**
 * SpreadsheetML (Office 2003 XML) parser utility.
 * Shared by the TargetCross connector and the XML data loader.
 *
 * Returns rows as plain objects keyed by the header row values.
 */

const xml2js = require("xml2js");

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Parse a SpreadsheetML file and return an array of row objects.
 * The first row is treated as headers; subsequent rows become key-value pairs.
 *
 * @param {string} filePath - absolute path to the .xml file
 * @returns {Promise<Record<string, string>[]>}
 */
async function parseSpreadsheetML(filePath) {
  const fs   = require("fs");
  const xml  = fs.readFileSync(filePath, "utf8");
  const parser = new xml2js.Parser({
    explicitArray: false,
    ignoreAttrs:   true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });
  const result = await parser.parseStringPromise(xml);

  const wb    = result?.Workbook ?? result;
  const ws    = toArray(wb?.Worksheet)[0];
  const table = toArray(ws?.Table)[0];
  const rows  = toArray(table?.Row);

  if (rows.length === 0) return [];

  const headers = toArray(rows[0]?.Cell).map(cell =>
    String(cell?.Data ?? "").trim()
  );

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = toArray(rows[i]?.Cell);
    const rec   = {};
    cells.forEach((cell, idx) => {
      if (idx >= headers.length || !headers[idx]) return;
      rec[headers[idx]] = String(cell?.Data ?? "").trim();
    });
    if (Object.values(rec).some(v => v !== "")) records.push(rec);
  }
  return records;
}

module.exports = { parseSpreadsheetML };
