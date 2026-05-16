-- Segnalazioni v2 migration — run once in D1 Console, one statement at a time
-- Safe to re-run (duplicate column errors are harmless — just skip that statement)

-- 1. Add settore column (shown in the segnalazioni list UI)
ALTER TABLE segnalazioni ADD COLUMN settore TEXT NOT NULL DEFAULT '';

-- 2. Add reporter_name column (who filed the report)
ALTER TABLE segnalazioni ADD COLUMN reporter_name TEXT NOT NULL DEFAULT '';

-- 3. Add available_from column (vehicle available from date)
ALTER TABLE segnalazioni ADD COLUMN available_from TEXT DEFAULT NULL;

-- 4. Add photo_url column (R2 URL from /api/upload)
ALTER TABLE segnalazioni ADD COLUMN photo_url TEXT DEFAULT NULL;
