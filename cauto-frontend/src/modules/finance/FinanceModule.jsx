import React, { useState, useCallback } from "react";
import { useAuth }  from "@/core/auth/AuthContext";
import { usePerms } from "@/core/permissions/PermContext";
import { useApi }   from "@/hooks/useApi";
import { API }      from "@/api";
import T, { alpha } from "@/theme";
import TabBar        from "@/shared/ui/TabBar";
import Spinner       from "@/shared/ui/Spinner";
import ApiError      from "@/shared/ui/ApiError";
import Icon          from "@/shared/ui/Icon";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) { return n == null ? "—" : `€${Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function pct(actual, budget) {
  if (!budget) return null;
  return Math.round((actual / budget) * 100);
}

function PctBar({ value }) {
  if (value == null) return <span style={{ color: T.textDim, fontSize: 11 }}>—</span>;
  const over = value > 100;
  const bar  = Math.min(value, 100);
  const col  = value > 100 ? T.red : value > 80 ? T.orange : T.green;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: alpha(col, 20), borderRadius: 2, minWidth: 60 }}>
        <div style={{ width: `${bar}%`, height: "100%", background: col, borderRadius: 2, transition: "width 400ms" }} />
      </div>
      <span style={{ fontSize: 11, color: col, fontFamily: T.mono, fontWeight: 600, minWidth: 34, textAlign: "right" }}>
        {over ? `+${value - 100}%` : `${value}%`}
      </span>
    </div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text }}>{title}</h3>
      {action}
    </div>
  );
}

function Btn({ onClick, children, variant = "primary", small, disabled }) {
  const bg = variant === "danger" ? T.red : variant === "ghost" ? "transparent" : T.blue;
  const color = variant === "ghost" ? T.textSub : "#fff";
  const border = variant === "ghost" ? `1px solid ${T.border}` : "none";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "5px 12px" : "8px 16px",
      background: disabled ? alpha(T.textDim, 20) : bg,
      color: disabled ? T.textDim : color,
      border,
      borderRadius: 7,
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: small ? 12 : 13,
      fontWeight: 600,
      fontFamily: T.font,
      display: "flex", alignItems: "center", gap: 6,
      transition: "opacity 0.15s",
    }}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: 24, minWidth: 340, maxWidth: 520, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: 4 }}>
            <Icon d="M18 6L6 18M6 6l12 12" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
      width: "100%", padding: "9px 12px", background: T.bg, border: `1px solid ${T.border}`,
      borderRadius: 7, color: T.text, fontSize: 13, fontFamily: T.font, boxSizing: "border-box",
    }} />
  );
}

// ── OrgTab: Departments & Sectors ─────────────────────────────────────────────

function OrgTab({ canEdit, auth }) {
  const { data, loading, error, refetch } = useApi("/finance/departments");
  const [modal, setModal]     = useState(null); // null | { type, data }
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [apiErr, setApiErr]   = useState("");

  const apiFetch = useCallback(async (path, opts) => {
    const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, ...opts });
    return r.json();
  }, [auth.token]);

  const openModal = (type, data = {}) => { setModal({ type, data }); setForm(data); setApiErr(""); };
  const closeModal = () => { setModal(null); setForm({}); };

  const save = async () => {
    setSaving(true); setApiErr("");
    try {
      let res;
      const { type, data } = modal;
      if (type === "new-dept") {
        res = await apiFetch("/finance/departments", { method: "POST", body: JSON.stringify({ name: form.name }) });
      } else if (type === "edit-dept") {
        res = await apiFetch(`/finance/departments/${data.id}`, { method: "PATCH", body: JSON.stringify({ name: form.name }) });
      } else if (type === "del-dept") {
        res = await apiFetch(`/finance/departments/${data.id}`, { method: "DELETE" });
      } else if (type === "new-sector") {
        res = await apiFetch("/finance/sectors", { method: "POST", body: JSON.stringify({ name: form.name, department_id: data.department_id }) });
      } else if (type === "edit-sector") {
        res = await apiFetch(`/finance/sectors/${data.id}`, { method: "PATCH", body: JSON.stringify({ name: form.name }) });
      } else if (type === "del-sector") {
        res = await apiFetch(`/finance/sectors/${data.id}`, { method: "DELETE" });
      }
      if (!res.ok) { setApiErr(res.error || "Errore"); return; }
      refetch(); closeModal();
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner />;
  if (error)   return <ApiError error={error} onRetry={refetch} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader
        title="Struttura organizzativa"
        action={canEdit && <Btn onClick={() => openModal("new-dept")} small><Icon d="M12 5v14M5 12h14" size={13} /> Nuovo dipartimento</Btn>}
      />

      {(!data || data.length === 0) && (
        <div style={{ padding: 32, textAlign: "center", color: T.textDim, fontSize: 13 }}>
          Nessun dipartimento. Creane uno per iniziare.
        </div>
      )}

      {data?.map(dept => (
        <div key={dept.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Icon d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16M1 21h22" size={16} color={T.blue} />
            <span style={{ fontWeight: 700, fontSize: 14, color: T.text, flex: 1 }}>{dept.name}</span>
            {canEdit && (
              <div style={{ display: "flex", gap: 6 }}>
                <Btn small variant="ghost" onClick={() => openModal("edit-dept", dept)}><Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={13} /></Btn>
                <Btn small variant="ghost" onClick={() => openModal("del-dept", dept)}><Icon d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" size={13} /></Btn>
                <Btn small onClick={() => openModal("new-sector", { department_id: dept.id, deptName: dept.name })}><Icon d="M12 5v14M5 12h14" size={12} /> Settore</Btn>
              </div>
            )}
          </div>

          {dept.sectors?.length === 0 && (
            <div style={{ fontSize: 12, color: T.textDim, padding: "4px 0 0 24px" }}>Nessun settore</div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingLeft: 24 }}>
            {dept.sectors?.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, background: alpha(T.blue, 10), border: `1px solid ${alpha(T.blue, 25)}`, borderRadius: 8, padding: "5px 10px" }}>
                <span style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>{s.name}</span>
                {canEdit && (
                  <>
                    <button onClick={() => openModal("edit-sector", s)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textDim, padding: 0, display: "flex" }}><Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={11} /></button>
                    <button onClick={() => openModal("del-sector", s)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: 0, display: "flex" }}><Icon d="M18 6L6 18M6 6l12 12" size={11} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {modal && (
        <Modal
          title={
            modal.type === "new-dept"    ? "Nuovo dipartimento" :
            modal.type === "edit-dept"   ? "Rinomina dipartimento" :
            modal.type === "del-dept"    ? "Elimina dipartimento" :
            modal.type === "new-sector"  ? `Nuovo settore — ${modal.data.deptName}` :
            modal.type === "edit-sector" ? "Rinomina settore" :
                                           "Elimina settore"
          }
          onClose={closeModal}
        >
          {modal.type.startsWith("del") ? (
            <>
              <p style={{ color: T.textSub, fontSize: 13, margin: "0 0 16px" }}>
                Sei sicuro di voler eliminare <strong>{modal.data.name}</strong>? L'operazione non è reversibile.
              </p>
              {apiErr && <div style={{ color: T.red, fontSize: 12, marginBottom: 12 }}>{apiErr}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn variant="ghost" onClick={closeModal}>Annulla</Btn>
                <Btn variant="danger" onClick={save} disabled={saving}>Elimina</Btn>
              </div>
            </>
          ) : (
            <>
              <Field label="Nome">
                <Input value={form.name || ""} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Es. Raccolta RSU" />
              </Field>
              {apiErr && <div style={{ color: T.red, fontSize: 12, marginBottom: 12 }}>{apiErr}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn variant="ghost" onClick={closeModal}>Annulla</Btn>
                <Btn onClick={save} disabled={saving || !form.name?.trim()}>Salva</Btn>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── SummaryTab: actuals vs. budget for current month ──────────────────────────

function SummaryTab({ auth }) {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const { data: summary, loading, error, refetch } = useApi(`/finance/summary?year=${year}&month=${month}`);
  const { data: depts } = useApi("/finance/departments");

  const sectorName = useCallback((id) => {
    if (!depts) return id;
    for (const d of depts) {
      const s = d.sectors?.find(s => s.id === id);
      if (s) return `${d.name} › ${s.name}`;
    }
    return id;
  }, [depts]);

  const MONTHS = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

  if (loading) return <Spinner />;
  if (error)   return <ApiError error={error} onRetry={refetch} />;

  const rows = summary || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Period picker */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: "7px 10px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 13, fontFamily: T.font }}>
          {[now.getUTCFullYear() - 1, now.getUTCFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding: "7px 10px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 13, fontFamily: T.font }}>
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.textDim }}>
          {rows.length > 0 ? `${rows.length} settori · aggiornato ${rows[0]?.computed_at?.slice(0,10) || "—"}` : "Nessun consuntivo disponibile"}
        </span>
      </div>

      {rows.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: T.textDim, fontSize: 13 }}>
          Il cron notturno non ha ancora elaborato dati per questo periodo.
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {["Settore", "Carburante", "Manutenzione", "Operazioni", "Totale", "Budget", "Previsione", "% Budget"].map(h => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", color: T.textSub, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const p = pct(r.total, r.budget);
                return (
                  <tr key={r.sector_id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "11px 14px", color: T.text, fontWeight: 500, whiteSpace: "nowrap" }}>{sectorName(r.sector_id)}</td>
                    <td style={{ padding: "11px 14px", color: T.textSub, fontFamily: T.mono, fontSize: 12 }}>{fmt(r.fuel_total)}</td>
                    <td style={{ padding: "11px 14px", color: T.textSub, fontFamily: T.mono, fontSize: 12 }}>{fmt(r.maintenance_total)}</td>
                    <td style={{ padding: "11px 14px", color: T.textSub, fontFamily: T.mono, fontSize: 12 }}>{fmt(r.operations_total)}</td>
                    <td style={{ padding: "11px 14px", color: T.text, fontFamily: T.mono, fontSize: 13, fontWeight: 600 }}>{fmt(r.total)}</td>
                    <td style={{ padding: "11px 14px", color: T.textDim, fontFamily: T.mono, fontSize: 12 }}>{fmt(r.budget)}</td>
                    <td style={{ padding: "11px 14px", color: T.teal, fontFamily: T.mono, fontSize: 12 }}>{fmt(r.forecast)}</td>
                    <td style={{ padding: "11px 14px", minWidth: 120 }}><PctBar value={p} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── BudgetsTab: budget list + lines management ────────────────────────────────

function BudgetsTab({ canEdit, auth }) {
  const { data: depts } = useApi("/finance/departments");
  const { data: budgets, loading, error, refetch } = useApi("/finance/budgets");
  const [modal, setModal]  = useState(null);
  const [form, setForm]    = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState("");

  const apiFetch = useCallback(async (path, opts) => {
    const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, ...opts });
    return r.json();
  }, [auth.token]);

  const allSectors = depts?.flatMap(d => d.sectors?.map(s => ({ ...s, deptName: d.name })) ?? []) ?? [];

  const openNew = () => { setModal({ type: "new" }); setForm({ year_start: new Date().getUTCFullYear(), year_end: new Date().getUTCFullYear(), total_amount: 0, currency: "EUR", type: "annual" }); setApiErr(""); };
  const openDel = (b) => { setModal({ type: "del", data: b }); setApiErr(""); };
  const close   = () => { setModal(null); setForm({}); };

  const save = async () => {
    setSaving(true); setApiErr("");
    try {
      let res;
      if (modal.type === "new") {
        res = await apiFetch("/finance/budgets", { method: "POST", body: JSON.stringify(form) });
      } else if (modal.type === "del") {
        res = await apiFetch(`/finance/budgets/${modal.data.id}`, { method: "DELETE" });
      }
      if (!res.ok) { setApiErr(res.error || "Errore"); return; }
      refetch(); close();
    } finally { setSaving(false); }
  };

  const sectorLabel = (id) => {
    const s = allSectors.find(s => s.id === id);
    return s ? `${s.deptName} › ${s.name}` : id;
  };

  if (loading) return <Spinner />;
  if (error)   return <ApiError error={error} onRetry={refetch} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader
        title="Budget per settore"
        action={canEdit && <Btn onClick={openNew} small><Icon d="M12 5v14M5 12h14" size={13} /> Nuovo budget</Btn>}
      />

      {(!budgets || budgets.length === 0) && (
        <div style={{ padding: 32, textAlign: "center", color: T.textDim, fontSize: 13 }}>
          Nessun budget definito. Crea prima i settori nella scheda Organizzazione.
        </div>
      )}

      {budgets && budgets.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {["Settore", "Etichetta", "Tipo", "Anni", "Importo totale", ""].map(h => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", color: T.textSub, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {budgets.map(b => (
                <tr key={b.id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "11px 14px", color: T.text, fontWeight: 500 }}>{sectorLabel(b.sector_id)}</td>
                  <td style={{ padding: "11px 14px", color: T.text }}>{b.label}</td>
                  <td style={{ padding: "11px 14px", color: T.textDim, textTransform: "capitalize" }}>{b.type}</td>
                  <td style={{ padding: "11px 14px", color: T.textDim, fontFamily: T.mono, fontSize: 12 }}>{b.year_start === b.year_end ? b.year_start : `${b.year_start}–${b.year_end}`}</td>
                  <td style={{ padding: "11px 14px", color: T.green, fontFamily: T.mono, fontWeight: 600 }}>{fmt(b.total_amount)}</td>
                  <td style={{ padding: "11px 14px" }}>
                    {canEdit && (
                      <button onClick={() => openDel(b)} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, padding: 0, display: "flex" }}>
                        <Icon d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === "new" && (
        <Modal title="Nuovo budget" onClose={close}>
          <Field label="Settore">
            <select value={form.sector_id || ""} onChange={e => setForm(f => ({ ...f, sector_id: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 13, fontFamily: T.font }}>
              <option value="">— seleziona —</option>
              {allSectors.map(s => <option key={s.id} value={s.id}>{s.deptName} › {s.name}</option>)}
            </select>
          </Field>
          <Field label="Etichetta"><Input value={form.label || ""} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="Es. Budget 2025" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Anno inizio"><Input type="number" value={form.year_start || ""} onChange={v => setForm(f => ({ ...f, year_start: Number(v) }))} /></Field>
            <Field label="Anno fine"><Input type="number" value={form.year_end || ""} onChange={v => setForm(f => ({ ...f, year_end: Number(v) }))} /></Field>
          </div>
          <Field label="Importo totale (€)"><Input type="number" value={form.total_amount ?? ""} onChange={v => setForm(f => ({ ...f, total_amount: Number(v) }))} /></Field>
          {apiErr && <div style={{ color: T.red, fontSize: 12, marginBottom: 12 }}>{apiErr}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={close}>Annulla</Btn>
            <Btn onClick={save} disabled={saving || !form.sector_id || !form.label?.trim()}>Crea budget</Btn>
          </div>
        </Modal>
      )}

      {modal?.type === "del" && (
        <Modal title="Elimina budget" onClose={close}>
          <p style={{ color: T.textSub, fontSize: 13, margin: "0 0 16px" }}>
            Eliminare <strong>{modal.data.label}</strong>? Questa azione rimuove anche tutte le righe mensili e le previsioni.
          </p>
          {apiErr && <div style={{ color: T.red, fontSize: 12, marginBottom: 12 }}>{apiErr}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={close}>Annulla</Btn>
            <Btn variant="danger" onClick={save} disabled={saving}>Elimina</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function FinanceModule() {
  const { auth }  = useAuth();
  const { can }   = usePerms();
  const canEdit   = can("finance", "edit");
  const [tab, setTab] = useState("summary");

  const tabs = [
    { id: "summary",  label: "Consuntivi",     icon: "M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3" },
    { id: "budgets",  label: "Budget",          icon: "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
    { id: "org",      label: "Organizzazione",  icon: "M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16M1 21h22" },
  ];

  return (
    <div style={{ fontFamily: T.font }}>
      <TabBar tabs={tabs} active={tab} onChange={setTab} />
      {tab === "summary" && <SummaryTab auth={auth} />}
      {tab === "budgets" && <BudgetsTab canEdit={canEdit} auth={auth} />}
      {tab === "org"     && <OrgTab canEdit={canEdit} auth={auth} />}
    </div>
  );
}
