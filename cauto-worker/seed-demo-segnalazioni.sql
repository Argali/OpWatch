-- Demo seed: Segnalazioni Territorio + Officina
-- Run in Cloudflare D1 Console (one block at a time is fine)
-- tenant_id = 'cauto' matches DEFAULT_TENANT_ID in wrangler.toml

-- ── Segnalazioni Territorio ───────────────────────────────────────────────────
INSERT OR IGNORE INTO segnalazioni_territorio
  (id, tenant_id, tipo, lat, lng, address, comune, description, photos, reported_by, status, created_at)
VALUES
  ('demo-terr-001', 'cauto', 'mancata_raccolta', 44.8381, 11.6198,
   'Via Garibaldi 12', 'Ferrara',
   'Sacchi non ritirati da 3 giorni, accumulo significativo sul marciapiede.',
   '[]', 'mario.rossi@cauto.it', 'aperta', datetime('now', '-2 days')),

  ('demo-terr-002', 'cauto', 'abbandono', 44.8321, 11.6301,
   'Via Emilia 45', 'Ferrara',
   'Frigorifero e materassi abbandonati vicino al cassonetto.',
   '[]', 'luigi.bianchi@cauto.it', 'in_lavorazione', datetime('now', '-5 days')),

  ('demo-terr-003', 'cauto', 'da_pulire', 44.8412, 11.6089,
   'Piazza Ariostea', 'Ferrara',
   'Zona sporca dopo evento del weekend, bottiglie e rifiuti sparsi.',
   '[]', 'anna.verdi@cauto.it', 'chiusa', datetime('now', '-10 days')),

  ('demo-terr-004', 'cauto', 'abbandono', 44.8290, 11.6250,
   'Via Bologna 78', 'Ferrara',
   'Pneumatici abbandonati nel parcheggio, circa 6 gomme.',
   '[]', 'mario.rossi@cauto.it', 'aperta', datetime('now', '-1 days')),

  ('demo-terr-005', 'cauto', 'mancata_raccolta', 44.8350, 11.6150,
   'Via Mazzini 33', 'Ferrara',
   'Organico non raccolto, odori fastidiosi.',
   '[]', 'luigi.bianchi@cauto.it', 'aperta', datetime('now', '-3 hours'));

-- ── Segnalazioni Officina ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO segnalazioni
  (id, tenant_id, tipo, vehicle, plate, description, reported_by, settore, reporter_name, available_from, photo_url, status, created_at)
VALUES
  ('demo-off-001', 'cauto', 'guasto', 'Camion 01', 'FE-123-AA',
   'Perdita olio motore, macchia visibile sotto il veicolo. Necessaria verifica urgente.',
   'mario.rossi@cauto.it', 'A', 'Mario Rossi',
   date('now', '+3 days'), null, 'aperta', datetime('now', '-1 days')),

  ('demo-off-002', 'cauto', 'manutenzione', 'Camion 02', 'FE-456-BB',
   'Tagliando ordinario 100.000 km: olio, filtri, cinghia distribuzione.',
   'luigi.bianchi@cauto.it', 'B', 'Luigi Bianchi',
   date('now', '+1 days'), null, 'in_lavorazione', datetime('now', '-3 days')),

  ('demo-off-003', 'cauto', 'incidente', 'Furgone 01', 'FE-789-CC',
   'Ammaccatura paraurti anteriore e faro rotto, piccola collisione in manovra.',
   'anna.verdi@cauto.it', 'A', 'Anna Verdi',
   date('now', '+5 days'), null, 'aperta', datetime('now', '-6 hours')),

  ('demo-off-004', 'cauto', 'guasto', 'Camion 03', 'FE-012-DD',
   'Freni anteriori consumati, rumore metallico durante la frenata.',
   'mario.rossi@cauto.it', 'C', 'Mario Rossi',
   date('now', '+2 days'), null, 'chiusa', datetime('now', '-7 days')),

  ('demo-off-005', 'cauto', 'manutenzione', 'Camion 01', 'FE-123-AA',
   'Sostituzione pneumatici anteriori, usura al limite legale.',
   'luigi.bianchi@cauto.it', 'A', 'Luigi Bianchi',
   date('now', '+4 days'), null, 'in_lavorazione', datetime('now', '-2 days'));
