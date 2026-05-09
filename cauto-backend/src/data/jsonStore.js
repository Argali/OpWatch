/**
 * Generic atomic JSON persistence helper.
 *
 * Usage:
 *   const store = createStore("events.json", {});
 *   const current = store.read();
 *   await store.write({ ...current, newKey: value });
 *
 * - Loads once on creation into an in-memory cache.
 * - Writes are atomic: write to temp file → rename (no partial file corruption).
 * - Flushes are debounced (500ms) to batch rapid consecutive writes.
 * - Data directory resolves from PLANNING_DATA_DIR env var, or <repo_root>/data.
 */

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const DATA_DIR = process.env.PLANNING_DATA_DIR
  ? path.resolve(process.env.PLANNING_DATA_DIR)
  : path.resolve(__dirname, "../../../data");

// Ensure the data directory exists at module load time
fs.mkdirSync(DATA_DIR, { recursive: true });

/**
 * createStore(filename, defaultValue)
 *
 * Returns { read, write } where:
 *   read()       — synchronous, returns current in-memory value
 *   write(data)  — sets in-memory immediately, queues async disk flush
 */
function createStore(filename, defaultValue) {
  const filePath = path.join(DATA_DIR, filename);

  // --- Load from disk on startup ---
  let cache;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    cache = JSON.parse(raw);
  } catch {
    cache = defaultValue;
  }

  let flushTimer = null;

  async function flush() {
    const tmp = path.join(os.tmpdir(), `fleetcc-${filename}-${process.pid}.tmp`);
    try {
      await fs.promises.writeFile(tmp, JSON.stringify(cache, null, 2), "utf8");
      await fs.promises.rename(tmp, filePath);
    } catch (err) {
      console.error(`[jsonStore] Failed to flush ${filename}:`, err.message);
      // Clean up temp file if it exists
      fs.unlink(tmp, () => {});
    }
  }

  function read() {
    return cache;
  }

  function write(data) {
    cache = data;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 500);
  }

  return { read, write };
}

module.exports = { createStore, DATA_DIR };
