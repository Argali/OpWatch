-- Routes v2 migration — run once in D1 Console, one statement at a time
-- Safe to re-run (duplicate column errors are harmless — just skip that statement)

-- 1. Add transit_segments_json column (array of segment indices that are transit/no-raccolta)
ALTER TABLE routes ADD COLUMN transit_segments_json TEXT NOT NULL DEFAULT '[]';

-- 2. Add show_arrows column (boolean: show direction arrows along the route)
ALTER TABLE routes ADD COLUMN show_arrows INTEGER NOT NULL DEFAULT 0;
