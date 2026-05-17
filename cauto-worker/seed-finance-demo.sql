-- OpsFinance demo seed — tenant: cauto
-- 3 departments · 6 sectors · 12 budgets (2025+2026) · 144 budget lines
-- 96 actuals (2025 full year + 2026 Jan–Apr) · 6 forecasts

-- ── 1. Departments ────────────────────────────────────────────────────────────
INSERT INTO budget_departments (id, tenant_id, name) VALUES
  ('dept-raccolta',     'cauto', 'Raccolta'),
  ('dept-manutenzione', 'cauto', 'Manutenzione'),
  ('dept-operazioni',   'cauto', 'Operazioni')
ON CONFLICT(tenant_id, name) DO NOTHING;

-- ── 2. Sectors ────────────────────────────────────────────────────────────────
INSERT INTO budget_sectors (id, tenant_id, department_id, name) VALUES
  ('sec-rsu',    'cauto', 'dept-raccolta',     'RSU'),
  ('sec-diff',   'cauto', 'dept-raccolta',     'Differenziata'),
  ('sec-off-fe', 'cauto', 'dept-manutenzione', 'Officina Ferrara'),
  ('sec-off-ce', 'cauto', 'dept-manutenzione', 'Officina Cento'),
  ('sec-spazz',  'cauto', 'dept-operazioni',   'Spazzamento'),
  ('sec-log',    'cauto', 'dept-operazioni',   'Logistica')
ON CONFLICT(tenant_id, department_id, name) DO NOTHING;

-- ── 3. Budgets ────────────────────────────────────────────────────────────────
INSERT INTO budgets (id, tenant_id, sector_id, label, type, year_start, year_end, total_amount, currency) VALUES
  ('bgt-rsu-25',    'cauto', 'sec-rsu',    'RSU 2025',              'annual', 2025, 2025, 480000, 'EUR'),
  ('bgt-diff-25',   'cauto', 'sec-diff',   'Differenziata 2025',   'annual', 2025, 2025, 240000, 'EUR'),
  ('bgt-off-fe-25', 'cauto', 'sec-off-fe', 'Officina Ferrara 2025','annual', 2025, 2025, 200000, 'EUR'),
  ('bgt-off-ce-25', 'cauto', 'sec-off-ce', 'Officina Cento 2025',  'annual', 2025, 2025, 120000, 'EUR'),
  ('bgt-spazz-25',  'cauto', 'sec-spazz',  'Spazzamento 2025',     'annual', 2025, 2025, 280000, 'EUR'),
  ('bgt-log-25',    'cauto', 'sec-log',    'Logistica 2025',       'annual', 2025, 2025, 150000, 'EUR'),
  ('bgt-rsu-26',    'cauto', 'sec-rsu',    'RSU 2026',              'annual', 2026, 2026, 504000, 'EUR'),
  ('bgt-diff-26',   'cauto', 'sec-diff',   'Differenziata 2026',   'annual', 2026, 2026, 252000, 'EUR'),
  ('bgt-off-fe-26', 'cauto', 'sec-off-fe', 'Officina Ferrara 2026','annual', 2026, 2026, 210000, 'EUR'),
  ('bgt-off-ce-26', 'cauto', 'sec-off-ce', 'Officina Cento 2026',  'annual', 2026, 2026, 126000, 'EUR'),
  ('bgt-spazz-26',  'cauto', 'sec-spazz',  'Spazzamento 2026',     'annual', 2026, 2026, 294000, 'EUR'),
  ('bgt-log-26',    'cauto', 'sec-log',    'Logistica 2026',       'annual', 2026, 2026, 157500, 'EUR');

-- ── 4. Budget lines 2025 — RSU + Differenziata ────────────────────────────────
INSERT INTO budget_lines (id, budget_id, tenant_id, year, month, amount) VALUES
  ('bl-rsu-25-01','bgt-rsu-25','cauto',2025, 1,38000),('bl-rsu-25-02','bgt-rsu-25','cauto',2025, 2,36000),
  ('bl-rsu-25-03','bgt-rsu-25','cauto',2025, 3,40000),('bl-rsu-25-04','bgt-rsu-25','cauto',2025, 4,40000),
  ('bl-rsu-25-05','bgt-rsu-25','cauto',2025, 5,42000),('bl-rsu-25-06','bgt-rsu-25','cauto',2025, 6,44000),
  ('bl-rsu-25-07','bgt-rsu-25','cauto',2025, 7,44000),('bl-rsu-25-08','bgt-rsu-25','cauto',2025, 8,44000),
  ('bl-rsu-25-09','bgt-rsu-25','cauto',2025, 9,42000),('bl-rsu-25-10','bgt-rsu-25','cauto',2025,10,40000),
  ('bl-rsu-25-11','bgt-rsu-25','cauto',2025,11,38000),('bl-rsu-25-12','bgt-rsu-25','cauto',2025,12,32000),
  ('bl-df-25-01','bgt-diff-25','cauto',2025, 1,19000),('bl-df-25-02','bgt-diff-25','cauto',2025, 2,18000),
  ('bl-df-25-03','bgt-diff-25','cauto',2025, 3,20000),('bl-df-25-04','bgt-diff-25','cauto',2025, 4,20000),
  ('bl-df-25-05','bgt-diff-25','cauto',2025, 5,21000),('bl-df-25-06','bgt-diff-25','cauto',2025, 6,22000),
  ('bl-df-25-07','bgt-diff-25','cauto',2025, 7,22000),('bl-df-25-08','bgt-diff-25','cauto',2025, 8,22000),
  ('bl-df-25-09','bgt-diff-25','cauto',2025, 9,21000),('bl-df-25-10','bgt-diff-25','cauto',2025,10,20000),
  ('bl-df-25-11','bgt-diff-25','cauto',2025,11,19000),('bl-df-25-12','bgt-diff-25','cauto',2025,12,16000)
ON CONFLICT(budget_id, year, month) DO NOTHING;

-- ── 5. Budget lines 2025 — Officine + Spazzamento + Logistica ─────────────────
INSERT INTO budget_lines (id, budget_id, tenant_id, year, month, amount) VALUES
  ('bl-ofe-25-01','bgt-off-fe-25','cauto',2025, 1,17000),('bl-ofe-25-02','bgt-off-fe-25','cauto',2025, 2,17000),
  ('bl-ofe-25-03','bgt-off-fe-25','cauto',2025, 3,17000),('bl-ofe-25-04','bgt-off-fe-25','cauto',2025, 4,17000),
  ('bl-ofe-25-05','bgt-off-fe-25','cauto',2025, 5,17000),('bl-ofe-25-06','bgt-off-fe-25','cauto',2025, 6,17000),
  ('bl-ofe-25-07','bgt-off-fe-25','cauto',2025, 7,17000),('bl-ofe-25-08','bgt-off-fe-25','cauto',2025, 8,17000),
  ('bl-ofe-25-09','bgt-off-fe-25','cauto',2025, 9,17000),('bl-ofe-25-10','bgt-off-fe-25','cauto',2025,10,17000),
  ('bl-ofe-25-11','bgt-off-fe-25','cauto',2025,11,17000),('bl-ofe-25-12','bgt-off-fe-25','cauto',2025,12,13000),
  ('bl-oce-25-01','bgt-off-ce-25','cauto',2025, 1,10000),('bl-oce-25-02','bgt-off-ce-25','cauto',2025, 2,10000),
  ('bl-oce-25-03','bgt-off-ce-25','cauto',2025, 3,10000),('bl-oce-25-04','bgt-off-ce-25','cauto',2025, 4,10000),
  ('bl-oce-25-05','bgt-off-ce-25','cauto',2025, 5,10000),('bl-oce-25-06','bgt-off-ce-25','cauto',2025, 6,10000),
  ('bl-oce-25-07','bgt-off-ce-25','cauto',2025, 7,10000),('bl-oce-25-08','bgt-off-ce-25','cauto',2025, 8,10000),
  ('bl-oce-25-09','bgt-off-ce-25','cauto',2025, 9,10000),('bl-oce-25-10','bgt-off-ce-25','cauto',2025,10,10000),
  ('bl-oce-25-11','bgt-off-ce-25','cauto',2025,11,10000),('bl-oce-25-12','bgt-off-ce-25','cauto',2025,12,10000),
  ('bl-sp-25-01','bgt-spazz-25','cauto',2025, 1,21000),('bl-sp-25-02','bgt-spazz-25','cauto',2025, 2,19000),
  ('bl-sp-25-03','bgt-spazz-25','cauto',2025, 3,23000),('bl-sp-25-04','bgt-spazz-25','cauto',2025, 4,25000),
  ('bl-sp-25-05','bgt-spazz-25','cauto',2025, 5,27000),('bl-sp-25-06','bgt-spazz-25','cauto',2025, 6,28000),
  ('bl-sp-25-07','bgt-spazz-25','cauto',2025, 7,28000),('bl-sp-25-08','bgt-spazz-25','cauto',2025, 8,27000),
  ('bl-sp-25-09','bgt-spazz-25','cauto',2025, 9,25000),('bl-sp-25-10','bgt-spazz-25','cauto',2025,10,23000),
  ('bl-sp-25-11','bgt-spazz-25','cauto',2025,11,21000),('bl-sp-25-12','bgt-spazz-25','cauto',2025,12,13000),
  ('bl-lg-25-01','bgt-log-25','cauto',2025, 1,12500),('bl-lg-25-02','bgt-log-25','cauto',2025, 2,12500),
  ('bl-lg-25-03','bgt-log-25','cauto',2025, 3,12500),('bl-lg-25-04','bgt-log-25','cauto',2025, 4,12500),
  ('bl-lg-25-05','bgt-log-25','cauto',2025, 5,12500),('bl-lg-25-06','bgt-log-25','cauto',2025, 6,12500),
  ('bl-lg-25-07','bgt-log-25','cauto',2025, 7,12500),('bl-lg-25-08','bgt-log-25','cauto',2025, 8,12500),
  ('bl-lg-25-09','bgt-log-25','cauto',2025, 9,12500),('bl-lg-25-10','bgt-log-25','cauto',2025,10,12500),
  ('bl-lg-25-11','bgt-log-25','cauto',2025,11,12500),('bl-lg-25-12','bgt-log-25','cauto',2025,12,12500)
ON CONFLICT(budget_id, year, month) DO NOTHING;

-- ── 6. Budget lines 2026 — all sectors ───────────────────────────────────────
INSERT INTO budget_lines (id, budget_id, tenant_id, year, month, amount) VALUES
  ('bl-rsu-26-01','bgt-rsu-26','cauto',2026, 1,40000),('bl-rsu-26-02','bgt-rsu-26','cauto',2026, 2,38000),
  ('bl-rsu-26-03','bgt-rsu-26','cauto',2026, 3,42000),('bl-rsu-26-04','bgt-rsu-26','cauto',2026, 4,42000),
  ('bl-rsu-26-05','bgt-rsu-26','cauto',2026, 5,44000),('bl-rsu-26-06','bgt-rsu-26','cauto',2026, 6,46000),
  ('bl-rsu-26-07','bgt-rsu-26','cauto',2026, 7,46000),('bl-rsu-26-08','bgt-rsu-26','cauto',2026, 8,46000),
  ('bl-rsu-26-09','bgt-rsu-26','cauto',2026, 9,44000),('bl-rsu-26-10','bgt-rsu-26','cauto',2026,10,42000),
  ('bl-rsu-26-11','bgt-rsu-26','cauto',2026,11,40000),('bl-rsu-26-12','bgt-rsu-26','cauto',2026,12,34000),
  ('bl-df-26-01','bgt-diff-26','cauto',2026, 1,20000),('bl-df-26-02','bgt-diff-26','cauto',2026, 2,19000),
  ('bl-df-26-03','bgt-diff-26','cauto',2026, 3,21000),('bl-df-26-04','bgt-diff-26','cauto',2026, 4,21000),
  ('bl-df-26-05','bgt-diff-26','cauto',2026, 5,22000),('bl-df-26-06','bgt-diff-26','cauto',2026, 6,23000),
  ('bl-df-26-07','bgt-diff-26','cauto',2026, 7,23000),('bl-df-26-08','bgt-diff-26','cauto',2026, 8,23000),
  ('bl-df-26-09','bgt-diff-26','cauto',2026, 9,22000),('bl-df-26-10','bgt-diff-26','cauto',2026,10,21000),
  ('bl-df-26-11','bgt-diff-26','cauto',2026,11,20000),('bl-df-26-12','bgt-diff-26','cauto',2026,12,17000),
  ('bl-ofe-26-01','bgt-off-fe-26','cauto',2026, 1,18000),('bl-ofe-26-02','bgt-off-fe-26','cauto',2026, 2,18000),
  ('bl-ofe-26-03','bgt-off-fe-26','cauto',2026, 3,18000),('bl-ofe-26-04','bgt-off-fe-26','cauto',2026, 4,18000),
  ('bl-ofe-26-05','bgt-off-fe-26','cauto',2026, 5,18000),('bl-ofe-26-06','bgt-off-fe-26','cauto',2026, 6,18000),
  ('bl-ofe-26-07','bgt-off-fe-26','cauto',2026, 7,18000),('bl-ofe-26-08','bgt-off-fe-26','cauto',2026, 8,18000),
  ('bl-ofe-26-09','bgt-off-fe-26','cauto',2026, 9,18000),('bl-ofe-26-10','bgt-off-fe-26','cauto',2026,10,18000),
  ('bl-ofe-26-11','bgt-off-fe-26','cauto',2026,11,18000),('bl-ofe-26-12','bgt-off-fe-26','cauto',2026,12,12000),
  ('bl-oce-26-01','bgt-off-ce-26','cauto',2026, 1,10500),('bl-oce-26-02','bgt-off-ce-26','cauto',2026, 2,10500),
  ('bl-oce-26-03','bgt-off-ce-26','cauto',2026, 3,10500),('bl-oce-26-04','bgt-off-ce-26','cauto',2026, 4,10500),
  ('bl-oce-26-05','bgt-off-ce-26','cauto',2026, 5,10500),('bl-oce-26-06','bgt-off-ce-26','cauto',2026, 6,10500),
  ('bl-oce-26-07','bgt-off-ce-26','cauto',2026, 7,10500),('bl-oce-26-08','bgt-off-ce-26','cauto',2026, 8,10500),
  ('bl-oce-26-09','bgt-off-ce-26','cauto',2026, 9,10500),('bl-oce-26-10','bgt-off-ce-26','cauto',2026,10,10500),
  ('bl-oce-26-11','bgt-off-ce-26','cauto',2026,11,10500),('bl-oce-26-12','bgt-off-ce-26','cauto',2026,12,10500),
  ('bl-sp-26-01','bgt-spazz-26','cauto',2026, 1,22000),('bl-sp-26-02','bgt-spazz-26','cauto',2026, 2,20000),
  ('bl-sp-26-03','bgt-spazz-26','cauto',2026, 3,24000),('bl-sp-26-04','bgt-spazz-26','cauto',2026, 4,26000),
  ('bl-sp-26-05','bgt-spazz-26','cauto',2026, 5,28000),('bl-sp-26-06','bgt-spazz-26','cauto',2026, 6,30000),
  ('bl-sp-26-07','bgt-spazz-26','cauto',2026, 7,30000),('bl-sp-26-08','bgt-spazz-26','cauto',2026, 8,28000),
  ('bl-sp-26-09','bgt-spazz-26','cauto',2026, 9,26000),('bl-sp-26-10','bgt-spazz-26','cauto',2026,10,24000),
  ('bl-sp-26-11','bgt-spazz-26','cauto',2026,11,22000),('bl-sp-26-12','bgt-spazz-26','cauto',2026,12,14000),
  ('bl-lg-26-01','bgt-log-26','cauto',2026, 1,13125),('bl-lg-26-02','bgt-log-26','cauto',2026, 2,13125),
  ('bl-lg-26-03','bgt-log-26','cauto',2026, 3,13125),('bl-lg-26-04','bgt-log-26','cauto',2026, 4,13125),
  ('bl-lg-26-05','bgt-log-26','cauto',2026, 5,13125),('bl-lg-26-06','bgt-log-26','cauto',2026, 6,13125),
  ('bl-lg-26-07','bgt-log-26','cauto',2026, 7,13125),('bl-lg-26-08','bgt-log-26','cauto',2026, 8,13125),
  ('bl-lg-26-09','bgt-log-26','cauto',2026, 9,13125),('bl-lg-26-10','bgt-log-26','cauto',2026,10,13125),
  ('bl-lg-26-11','bgt-log-26','cauto',2026,11,13125),('bl-lg-26-12','bgt-log-26','cauto',2026,12,13125)
ON CONFLICT(budget_id, year, month) DO NOTHING;

-- ── 7. Actuals 2025 — RSU ─────────────────────────────────────────────────────
INSERT INTO budget_actuals (id,tenant_id,sector_id,year,month,fuel_total,maintenance_total,operations_total) VALUES
  ('cauto__sec-rsu__2025__1', 'cauto','sec-rsu',2025, 1,22000, 9500, 6500),
  ('cauto__sec-rsu__2025__2', 'cauto','sec-rsu',2025, 2,20000, 9000, 6000),
  ('cauto__sec-rsu__2025__3', 'cauto','sec-rsu',2025, 3,24500,10500, 7000),
  ('cauto__sec-rsu__2025__4', 'cauto','sec-rsu',2025, 4,25000,11000, 7500),
  ('cauto__sec-rsu__2025__5', 'cauto','sec-rsu',2025, 5,26000,11500, 8000),
  ('cauto__sec-rsu__2025__6', 'cauto','sec-rsu',2025, 6,30000,12000, 9000),
  ('cauto__sec-rsu__2025__7', 'cauto','sec-rsu',2025, 7,29000,12500, 8500),
  ('cauto__sec-rsu__2025__8', 'cauto','sec-rsu',2025, 8,27000,11000, 7500),
  ('cauto__sec-rsu__2025__9', 'cauto','sec-rsu',2025, 9,25500,11000, 7500),
  ('cauto__sec-rsu__2025__10','cauto','sec-rsu',2025,10,24000,10500, 7000),
  ('cauto__sec-rsu__2025__11','cauto','sec-rsu',2025,11,22000, 9500, 6500),
  ('cauto__sec-rsu__2025__12','cauto','sec-rsu',2025,12,17500, 8000, 5500)
ON CONFLICT(tenant_id,sector_id,year,month) DO UPDATE SET
  fuel_total=excluded.fuel_total, maintenance_total=excluded.maintenance_total,
  operations_total=excluded.operations_total, computed_at=datetime('now');

-- ── 8. Actuals 2025 — Differenziata ──────────────────────────────────────────
INSERT INTO budget_actuals (id,tenant_id,sector_id,year,month,fuel_total,maintenance_total,operations_total) VALUES
  ('cauto__sec-diff__2025__1', 'cauto','sec-diff',2025, 1,12000,4500,2500),
  ('cauto__sec-diff__2025__2', 'cauto','sec-diff',2025, 2,11000,4000,2500),
  ('cauto__sec-diff__2025__3', 'cauto','sec-diff',2025, 3,13000,5000,3000),
  ('cauto__sec-diff__2025__4', 'cauto','sec-diff',2025, 4,12500,5000,2500),
  ('cauto__sec-diff__2025__5', 'cauto','sec-diff',2025, 5,13500,5500,3000),
  ('cauto__sec-diff__2025__6', 'cauto','sec-diff',2025, 6,15000,6000,3500),
  ('cauto__sec-diff__2025__7', 'cauto','sec-diff',2025, 7,14500,6000,3500),
  ('cauto__sec-diff__2025__8', 'cauto','sec-diff',2025, 8,14000,5500,3000),
  ('cauto__sec-diff__2025__9', 'cauto','sec-diff',2025, 9,13000,5000,2800),
  ('cauto__sec-diff__2025__10','cauto','sec-diff',2025,10,12500,5000,2800),
  ('cauto__sec-diff__2025__11','cauto','sec-diff',2025,11,11500,4500,2500),
  ('cauto__sec-diff__2025__12','cauto','sec-diff',2025,12,10000,3800,2200)
ON CONFLICT(tenant_id,sector_id,year,month) DO UPDATE SET
  fuel_total=excluded.fuel_total, maintenance_total=excluded.maintenance_total,
  operations_total=excluded.operations_total, computed_at=datetime('now');

-- ── 9. Actuals 2025 — Officina Ferrara ────────────────────────────────────────
INSERT INTO budget_actuals (id,tenant_id,sector_id,year,month,fuel_total,maintenance_total,operations_total) VALUES
  ('cauto__sec-off-fe__2025__1', 'cauto','sec-off-fe',2025, 1,2000,13000,2500),
  ('cauto__sec-off-fe__2025__2', 'cauto','sec-off-fe',2025, 2,1800,12500,2200),
  ('cauto__sec-off-fe__2025__3', 'cauto','sec-off-fe',2025, 3,2200,14000,2500),
  ('cauto__sec-off-fe__2025__4', 'cauto','sec-off-fe',2025, 4,2000,13500,2500),
  ('cauto__sec-off-fe__2025__5', 'cauto','sec-off-fe',2025, 5,2000,13000,2500),
  ('cauto__sec-off-fe__2025__6', 'cauto','sec-off-fe',2025, 6,1800,12500,2200),
  ('cauto__sec-off-fe__2025__7', 'cauto','sec-off-fe',2025, 7,1500,11500,2000),
  ('cauto__sec-off-fe__2025__8', 'cauto','sec-off-fe',2025, 8,1500,11000,1800),
  ('cauto__sec-off-fe__2025__9', 'cauto','sec-off-fe',2025, 9,2000,13000,2500),
  ('cauto__sec-off-fe__2025__10','cauto','sec-off-fe',2025,10,2200,14000,2500),
  ('cauto__sec-off-fe__2025__11','cauto','sec-off-fe',2025,11,2000,13500,2500),
  ('cauto__sec-off-fe__2025__12','cauto','sec-off-fe',2025,12,1500,10000,2000)
ON CONFLICT(tenant_id,sector_id,year,month) DO UPDATE SET
  fuel_total=excluded.fuel_total, maintenance_total=excluded.maintenance_total,
  operations_total=excluded.operations_total, computed_at=datetime('now');

-- ── 10. Actuals 2025 — Officina Cento ────────────────────────────────────────
INSERT INTO budget_actuals (id,tenant_id,sector_id,year,month,fuel_total,maintenance_total,operations_total) VALUES
  ('cauto__sec-off-ce__2025__1', 'cauto','sec-off-ce',2025, 1,1200,7800,1500),
  ('cauto__sec-off-ce__2025__2', 'cauto','sec-off-ce',2025, 2,1000,7500,1500),
  ('cauto__sec-off-ce__2025__3', 'cauto','sec-off-ce',2025, 3,1200,8200,1500),
  ('cauto__sec-off-ce__2025__4', 'cauto','sec-off-ce',2025, 4,1100,8000,1500),
  ('cauto__sec-off-ce__2025__5', 'cauto','sec-off-ce',2025, 5,1200,7800,1500),
  ('cauto__sec-off-ce__2025__6', 'cauto','sec-off-ce',2025, 6,1000,7200,1300),
  ('cauto__sec-off-ce__2025__7', 'cauto','sec-off-ce',2025, 7, 900,7000,1200),
  ('cauto__sec-off-ce__2025__8', 'cauto','sec-off-ce',2025, 8, 800,6500,1100),
  ('cauto__sec-off-ce__2025__9', 'cauto','sec-off-ce',2025, 9,1100,7800,1500),
  ('cauto__sec-off-ce__2025__10','cauto','sec-off-ce',2025,10,1200,8200,1500),
  ('cauto__sec-off-ce__2025__11','cauto','sec-off-ce',2025,11,1100,8000,1500),
  ('cauto__sec-off-ce__2025__12','cauto','sec-off-ce',2025,12, 900,7500,1300)
ON CONFLICT(tenant_id,sector_id,year,month) DO UPDATE SET
  fuel_total=excluded.fuel_total, maintenance_total=excluded.maintenance_total,
  operations_total=excluded.operations_total, computed_at=datetime('now');

-- ── 11. Actuals 2025 — Spazzamento ───────────────────────────────────────────
INSERT INTO budget_actuals (id,tenant_id,sector_id,year,month,fuel_total,maintenance_total,operations_total) VALUES
  ('cauto__sec-spazz__2025__1', 'cauto','sec-spazz',2025, 1, 9000,5000, 7500),
  ('cauto__sec-spazz__2025__2', 'cauto','sec-spazz',2025, 2, 8000,4500, 7000),
  ('cauto__sec-spazz__2025__3', 'cauto','sec-spazz',2025, 3,10000,5500, 8000),
  ('cauto__sec-spazz__2025__4', 'cauto','sec-spazz',2025, 4,11000,6000, 9000),
  ('cauto__sec-spazz__2025__5', 'cauto','sec-spazz',2025, 5,12000,6500, 9500),
  ('cauto__sec-spazz__2025__6', 'cauto','sec-spazz',2025, 6,13000,7000,10000),
  ('cauto__sec-spazz__2025__7', 'cauto','sec-spazz',2025, 7,12500,6500, 9500),
  ('cauto__sec-spazz__2025__8', 'cauto','sec-spazz',2025, 8,11000,6000, 8500),
  ('cauto__sec-spazz__2025__9', 'cauto','sec-spazz',2025, 9,11500,6000, 9000),
  ('cauto__sec-spazz__2025__10','cauto','sec-spazz',2025,10,10000,5500, 8000),
  ('cauto__sec-spazz__2025__11','cauto','sec-spazz',2025,11, 9500,5000, 7500),
  ('cauto__sec-spazz__2025__12','cauto','sec-spazz',2025,12, 5500,3000, 5000)
ON CONFLICT(tenant_id,sector_id,year,month) DO UPDATE SET
  fuel_total=excluded.fuel_total, maintenance_total=excluded.maintenance_total,
  operations_total=excluded.operations_total, computed_at=datetime('now');

-- ── 12. Actuals 2025 — Logistica ─────────────────────────────────────────────
INSERT INTO budget_actuals (id,tenant_id,sector_id,year,month,fuel_total,maintenance_total,operations_total) VALUES
  ('cauto__sec-log__2025__1', 'cauto','sec-log',2025, 1,6000,3000,4000),
  ('cauto__sec-log__2025__2', 'cauto','sec-log',2025, 2,5500,2800,3800),
  ('cauto__sec-log__2025__3', 'cauto','sec-log',2025, 3,6200,3200,4200),
  ('cauto__sec-log__2025__4', 'cauto','sec-log',2025, 4,6000,3000,4000),
  ('cauto__sec-log__2025__5', 'cauto','sec-log',2025, 5,6500,3200,4500),
  ('cauto__sec-log__2025__6', 'cauto','sec-log',2025, 6,7000,3500,5000),
  ('cauto__sec-log__2025__7', 'cauto','sec-log',2025, 7,7000,3500,5000),
  ('cauto__sec-log__2025__8', 'cauto','sec-log',2025, 8,5500,2500,3500),
  ('cauto__sec-log__2025__9', 'cauto','sec-log',2025, 9,6000,3000,4000),
  ('cauto__sec-log__2025__10','cauto','sec-log',2025,10,6000,3000,4000),
  ('cauto__sec-log__2025__11','cauto','sec-log',2025,11,5800,2800,3800),
  ('cauto__sec-log__2025__12','cauto','sec-log',2025,12,4500,2200,3000)
ON CONFLICT(tenant_id,sector_id,year,month) DO UPDATE SET
  fuel_total=excluded.fuel_total, maintenance_total=excluded.maintenance_total,
  operations_total=excluded.operations_total, computed_at=datetime('now');

-- ── 13. Actuals 2026 Jan–Apr — all sectors ────────────────────────────────────
INSERT INTO budget_actuals (id,tenant_id,sector_id,year,month,fuel_total,maintenance_total,operations_total) VALUES
  ('cauto__sec-rsu__2026__1',    'cauto','sec-rsu',   2026,1,24000,10000,6800),
  ('cauto__sec-rsu__2026__2',    'cauto','sec-rsu',   2026,2,22500, 9500,6200),
  ('cauto__sec-rsu__2026__3',    'cauto','sec-rsu',   2026,3,26000,11000,7500),
  ('cauto__sec-rsu__2026__4',    'cauto','sec-rsu',   2026,4,27000,11500,8000),
  ('cauto__sec-diff__2026__1',   'cauto','sec-diff',  2026,1,12500, 4800,2700),
  ('cauto__sec-diff__2026__2',   'cauto','sec-diff',  2026,2,11800, 4500,2500),
  ('cauto__sec-diff__2026__3',   'cauto','sec-diff',  2026,3,13500, 5200,3000),
  ('cauto__sec-diff__2026__4',   'cauto','sec-diff',  2026,4,13000, 5500,3000),
  ('cauto__sec-off-fe__2026__1', 'cauto','sec-off-fe',2026,1, 2200,13500,2800),
  ('cauto__sec-off-fe__2026__2', 'cauto','sec-off-fe',2026,2, 2000,13000,2500),
  ('cauto__sec-off-fe__2026__3', 'cauto','sec-off-fe',2026,3, 2300,14500,2800),
  ('cauto__sec-off-fe__2026__4', 'cauto','sec-off-fe',2026,4, 2200,14000,2800),
  ('cauto__sec-off-ce__2026__1', 'cauto','sec-off-ce',2026,1, 1300, 8200,1600),
  ('cauto__sec-off-ce__2026__2', 'cauto','sec-off-ce',2026,2, 1100, 7900,1500),
  ('cauto__sec-off-ce__2026__3', 'cauto','sec-off-ce',2026,3, 1300, 8500,1600),
  ('cauto__sec-off-ce__2026__4', 'cauto','sec-off-ce',2026,4, 1200, 8300,1600),
  ('cauto__sec-spazz__2026__1',  'cauto','sec-spazz', 2026,1, 9500, 5200,8000),
  ('cauto__sec-spazz__2026__2',  'cauto','sec-spazz', 2026,2, 8500, 4800,7200),
  ('cauto__sec-spazz__2026__3',  'cauto','sec-spazz', 2026,3,10500, 5800,8500),
  ('cauto__sec-spazz__2026__4',  'cauto','sec-spazz', 2026,4,11500, 6200,9500),
  ('cauto__sec-log__2026__1',    'cauto','sec-log',   2026,1, 6300, 3200,4200),
  ('cauto__sec-log__2026__2',    'cauto','sec-log',   2026,2, 5800, 3000,4000),
  ('cauto__sec-log__2026__3',    'cauto','sec-log',   2026,3, 6500, 3300,4400),
  ('cauto__sec-log__2026__4',    'cauto','sec-log',   2026,4, 6300, 3200,4200)
ON CONFLICT(tenant_id,sector_id,year,month) DO UPDATE SET
  fuel_total=excluded.fuel_total, maintenance_total=excluded.maintenance_total,
  operations_total=excluded.operations_total, computed_at=datetime('now');

-- ── 14. Forecasts (mid-year revisions) ───────────────────────────────────────
INSERT INTO budget_forecasts (id,budget_id,tenant_id,year,month,revised_amount,note,revised_by,revised_at) VALUES
  ('fc-rsu-25-06',   'bgt-rsu-25',   'cauto',2025,6, 50000,'Incremento stagionale estivo superiore alle aspettative','erwankervazo@gmail.com','2025-06-15 09:00:00'),
  ('fc-rsu-25-07',   'bgt-rsu-25',   'cauto',2025,7, 48000,'Confermato superamento budget estivo','erwankervazo@gmail.com','2025-07-10 09:00:00'),
  ('fc-rsu-25-12',   'bgt-rsu-25',   'cauto',2025,12,30000,'Dicembre previsto in risparmio','erwankervazo@gmail.com','2025-11-28 09:00:00'),
  ('fc-sp-25-06',    'bgt-spazz-25', 'cauto',2025,6, 32000,'Caldo anticipato richiede più passaggi','erwankervazo@gmail.com','2025-06-20 09:00:00'),
  ('fc-ofe-25-08',   'bgt-off-fe-25','cauto',2025,8, 14300,'Chiusura agosto — personale in ferie','erwankervazo@gmail.com','2025-07-25 09:00:00'),
  ('fc-rsu-26-04',   'bgt-rsu-26',   'cauto',2026,4, 48000,'Trend aprile sopra budget, attività straordinarie','erwankervazo@gmail.com','2026-04-18 09:00:00');
