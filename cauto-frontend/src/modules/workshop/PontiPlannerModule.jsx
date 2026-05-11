import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/core/auth/AuthContext";
import { useApi } from "@/hooks/useApi";
import { API } from "@/api";
import T, { alpha } from "@/theme";
import Spinner from "@/shared/ui/Spinner";
import Icon from "@/shared/ui/Icon";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07:00 – 19:00

const TYPE_COLOR = {
  Tagliando:          { bg: "#1e3a5f", border: "#3b82f6", text: "#93c5fd" },
  Freni:              { bg: "#3b2200", border: "#f59e0b", text: "#fcd34d" },
  Pneumatici:         { bg: "#052e16", border: "#22c55e", text: "#86efac" },
  "Impianto elettrico":{ bg: "#2e1065", border: "#a855f7", text: "#d8b4fe" },
  Revisione:          { bg: "#0c1a2e", border: "#38bdf8", text: "#7dd3fc" },
};
const DEFAULT_COLOR = { bg: "#1a1f2e", border: "#4a5568", text: "#a0aec0" };

function colorFor(type) { return TYPE_COLOR[type] || DEFAULT_COLOR; }

function todayISO() { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function shiftDate(iso, days) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Order detail modal ────────────────────────────────────────────────────────
const ORDER_STATUS_LABELS = {
  waiting_parts: "In Attesa",
  in_progress:   "In Lavorazione",
  done:          "Completato",
};
const ORDER_STATUS_STYLE = {
  waiting_parts: { bg: "#1a1f2e", border: "#4a5568",  text: "#a0aec0" },
  in_progress:   { bg: "#1e3a5f", border: "#3b82f6",  text: "#93c5fd" },
  done:          { bg: "#052e16", border: "#22c55e",  text: "#86efac" },
};

function OrderModal({ order, asgn, onClose, onSave }) {
  const [status, setStatus] = React.useState(order.status);
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(order.id, status);
    setSaving(false);
    onClose();
  };

  const c = colorFor(order.type);
  const unchanged = status === order.status;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1100,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#1a1f2e", border: `1px solid ${c.border}`, borderRadius: 14,
        padding: "24px 28px", width: 380, display: "flex", flexDirection: "column", gap: 16,
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)", fontFamily: "inherit",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{order.vehicle}</div>
            <div style={{ fontSize: 12, color: c.text, opacity: 0.6, fontFamily: "monospace" }}>{order.plate}</div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: "#a0aec0",
            cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 6px",
          }}>✕</button>
        </div>

        {/* Type + slot */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontWeight: 700 }}>
            {order.type}
          </span>
          {asgn && (
            <span style={{ fontSize: 11, color: "#a0aec0" }}>
              🔩 {asgn.ponte} · {String(asgn.startHour).padStart(2, "0")}:00 – {String(asgn.startHour + asgn.duration).padStart(2, "0")}:00
            </span>
          )}
        </div>

        {/* Notes */}
        {order.notes && (
          <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6, background: "#0f1117", borderRadius: 8, padding: "10px 14px" }}>
            {order.notes}
          </div>
        )}

        {/* Mechanic / ETA */}
        {(order.mechanic || order.eta) && (
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#718096" }}>
            {order.mechanic && <span>👤 {order.mechanic}</span>}
            {order.eta && <span>📅 ETA {order.eta}</span>}
          </div>
        )}

        {/* Status selector */}
        <div>
          <div style={{ fontSize: 11, color: "#718096", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Stato</div>
          <div style={{ display: "flex", gap: 8 }}>
            {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => {
              const s = ORDER_STATUS_STYLE[key];
              const active = status === key;
              return (
                <button key={key} onClick={() => setStatus(key)} style={{
                  flex: 1, padding: "8px 6px", borderRadius: 8, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 12, fontWeight: active ? 700 : 400,
                  background: active ? s.bg : "transparent",
                  border: `1px solid ${active ? s.border : "#2d3748"}`,
                  color: active ? s.text : "#718096",
                  transition: "all 0.15s",
                }}>{label}</button>
              );
            })}
          </div>
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving || unchanged} style={{
          padding: "10px 20px", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600,
          cursor: saving || unchanged ? "not-allowed" : "pointer",
          background: unchanged ? "transparent" : "#1e3a5f",
          border: `1px solid ${unchanged ? "#2d3748" : "#3b82f6"}`,
          color: unchanged ? "#4a5568" : "#93c5fd",
          transition: "all 0.15s",
        }}>
          {saving ? "Salvataggio…" : unchanged ? "Nessuna modifica" : "Salva stato"}
        </button>
      </div>
    </div>
  );
}

// ── Duration selector popover ─────────────────────────────────────────────────
function DurationPicker({ onSelect, onCancel }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.55)",
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Durata intervento</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 6, 8].map(h => (
            <button key={h} onClick={() => onSelect(h)} style={{
              padding: "8px 16px", borderRadius: 8, cursor: "pointer",
              background: T.navActive, border: `1px solid ${alpha(T.blue, 40)}`,
              color: T.blue, fontFamily: T.font, fontSize: 13, fontWeight: 600,
            }}>{h}h</button>
          ))}
        </div>
        <button onClick={onCancel} style={{
          alignSelf: "flex-end", fontSize: 12, padding: "4px 12px",
          background: "transparent", border: `1px solid ${T.border}`,
          borderRadius: 6, color: T.textSub, cursor: "pointer", fontFamily: T.font,
        }}>Annulla</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PontiPlannerModule() {
  const { auth } = useAuth();
  const { data: orders, loading: loadingOrders } = useApi("/workshop/orders");
  const { data: ponti, loading: loadingPonti } = useApi("/workshop/ponti");

  const [date, setDate] = useState(todayISO);
  const [assignments, setAssignments] = useState([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [pending, setPending] = useState(null);
  const [selected, setSelected] = useState(null); // { asgn, order }
  const dragRef = useRef(null);

  const loadPlan = useCallback(async () => {
    setLoadingPlan(true);
    try {
      const r = await fetch(`${API}/workshop/planning?date=${date}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const d = await r.json();
      if (d.ok) setAssignments(d.data);
    } catch {}
    setLoadingPlan(false);
  }, [date, auth.token]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onDragStart = useCallback((e, source) => {
    dragRef.current = source;
    e.dataTransfer.effectAllowed = "move";
    // Ghost image — transparent so the element itself serves as feedback
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-200px;opacity:0";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const onDragOver = useCallback((e, ponte, hour) => {
    // Block drop if a different assignment already owns this cell
    const occupied = assignments.find(a =>
      a.ponte === ponte && hour >= a.startHour && hour < a.startHour + a.duration
    );
    // Allow if it's the dragged assignment itself (moving)
    if (occupied && dragRef.current?.type === "assignment" && occupied.id === dragRef.current.id) {
      e.preventDefault(); return;
    }
    if (!occupied) e.preventDefault();
  }, [assignments]);

  const onDrop = useCallback((e, ponte, hour) => {
    e.preventDefault();
    const src = dragRef.current;
    if (!src) return;
    // Remove old assignment if moving from grid
    if (src.type === "assignment" && src.id) {
      fetch(`${API}/workshop/planning/${src.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.token}` },
      }).catch(() => {});
    }
    const orderId = src.type === "order" ? src.id : src.orderId;
    setPending({ ponte, hour, orderId });
    dragRef.current = null;
  }, [auth.token]);

  const confirmDuration = useCallback(async (duration) => {
    if (!pending) return;
    setPending(null);
    await fetch(`${API}/workshop/planning`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: pending.orderId, ponte: pending.ponte, date, startHour: pending.hour, duration }),
    });
    loadPlan();
  }, [pending, date, auth.token, loadPlan]);

  const removeAssignment = useCallback(async (id) => {
    await fetch(`${API}/workshop/planning/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    loadPlan();
  }, [auth.token, loadPlan]);

  const updateOrderStatus = useCallback(async (orderId, status) => {
    await fetch(`${API}/workshop/orders/${orderId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadPlan();
  }, [auth.token, loadPlan]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const assignedOrderIds = new Set(assignments.map(a => a.orderId));
  const unscheduled = (orders || []).filter(o =>
    !assignedOrderIds.has(o.id) && o.status !== "done"
  );

  // ── Loading / empty states ────────────────────────────────────────────────
  if (loadingOrders || loadingPonti) return <Spinner />;
  if (!ponti || ponti.length === 0) return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: 40, textAlign: "center", color: T.textSub, fontSize: 13,
    }}>
      Nessun ponte configurato.{" "}
      <span style={{ color: T.blue }}>Aggiungili da Admin → Officina.</span>
    </div>
  );

  const cellW = 90; // px per hour column
  const rowH  = 72; // px per ponte row

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: T.font }}>

      {/* ── Date navigator ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => setDate(d => shiftDate(d, -1))} style={navBtn}>
          <Icon d="M15 18l-6-6 6-6" size={16} />
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, textTransform: "capitalize" }}>
            {fmtDate(date)}
          </div>
        </div>
        <button onClick={() => setDate(d => shiftDate(d, 1))} style={navBtn}>
          <Icon d="M9 18l6-6-6-6" size={16} />
        </button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{
          background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7,
          padding: "6px 10px", color: T.text, fontSize: 12, outline: "none",
          fontFamily: T.font, colorScheme: "dark",
        }} />
        <button onClick={() => setDate(todayISO())} style={{
          ...navBtn, fontSize: 11, padding: "6px 12px", color: T.textSub,
        }}>Oggi</button>
      </div>

      <div style={{ display: "flex", gap: 16, minHeight: 400 }}>

        {/* ── Sidebar: unscheduled orders ── */}
        <div style={{
          width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
            Da pianificare ({unscheduled.length})
          </div>
          {unscheduled.length === 0 && (
            <div style={{ fontSize: 12, color: T.textDim, fontStyle: "italic" }}>
              Tutti gli ordini sono pianificati
            </div>
          )}
          {unscheduled.map(order => {
            const c = colorFor(order.type);
            return (
              <div key={order.id}
                draggable
                onDragStart={e => onDragStart(e, { type: "order", id: order.id })}
                style={{
                  background: c.bg, border: `1px solid ${c.border}`, borderRadius: 9,
                  padding: "10px 12px", cursor: "grab", userSelect: "none",
                  transition: "opacity 0.15s",
                }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{order.vehicle}</div>
                <div style={{ fontSize: 10, color: c.text, opacity: 0.8, marginTop: 2 }}>{order.type}</div>
                {order.plate && <div style={{ fontSize: 10, color: c.text, opacity: 0.6, fontFamily: T.mono }}>{order.plate}</div>}
              </div>
            );
          })}

          {/* Legend */}
          <div style={{ marginTop: "auto", paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, color: T.textDim, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Tipo</div>
            {Object.entries(TYPE_COLOR).map(([type, c]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c.border, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: T.textSub }}>{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Planning grid ── */}
        <div style={{ flex: 1, overflowX: "auto" }}>
          {loadingPlan
            ? <Spinner />
            : (
              <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: 160 + cellW * HOURS.length }}>
                <colgroup>
                  <col style={{ width: 120 }} />
                  {HOURS.map(h => <col key={h} style={{ width: cellW }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th style={thStyle}>Ponte</th>
                    {HOURS.map(h => (
                      <th key={h} style={{ ...thStyle, textAlign: "center", fontWeight: 400, color: T.textSub }}>
                        {String(h).padStart(2, "0")}:00
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ponti.map((ponte, pi) => {
                    const cells = [];
                    let hi = 0;
                    while (hi < HOURS.length) {
                      const hour = HOURS[hi];
                      const asgn = assignments.find(a => a.ponte === ponte && a.startHour === hour);
                      const order = asgn ? (orders || []).find(o => o.id === asgn.orderId) : null;
                      const span = asgn?.duration || 1;
                      const c = order ? colorFor(order.type) : null;

                      cells.push(
                        <td key={hour}
                          colSpan={asgn ? span : 1}
                          style={{
                            height: rowH, verticalAlign: "top", padding: 3,
                            background: pi % 2 === 0 ? alpha(T.border, 8) : "transparent",
                            border: `1px solid ${alpha(T.border, 30)}`,
                            borderLeft: hour === HOURS[0] ? `1px solid ${alpha(T.border, 30)}` : undefined,
                          }}
                          onDragOver={e => onDragOver(e, ponte, hour)}
                          onDrop={e => onDrop(e, ponte, hour)}
                        >
                          {asgn && order && (
                            <div
                              draggable
                              onDragStart={e => onDragStart(e, { type: "assignment", id: asgn.id, orderId: asgn.orderId })}
                              onClick={() => setSelected({ asgn, order })}
                              style={{
                                height: "100%", background: c.bg,
                                border: `1px solid ${c.border}`, borderRadius: 6,
                                padding: "6px 8px", cursor: "grab", userSelect: "none",
                                display: "flex", flexDirection: "column", justifyContent: "space-between",
                                position: "relative",
                              }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{order.vehicle}</div>
                                <div style={{ fontSize: 10, color: c.text, opacity: 0.75 }}>{order.type}</div>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <span style={{ fontSize: 9, color: c.text, opacity: 0.5, fontFamily: T.mono }}>{order.plate}</span>
                                <button
                                  onClick={ev => { ev.stopPropagation(); removeAssignment(asgn.id); }}
                                  style={{
                                    background: "transparent", border: "none", color: c.text,
                                    cursor: "pointer", fontSize: 12, padding: "0 2px", opacity: 0.6,
                                    lineHeight: 1,
                                  }}>✕</button>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                      hi += span;
                    }

                    return (
                      <tr key={ponte}>
                        <td style={{
                          padding: "0 12px", fontSize: 12, fontWeight: 700, color: T.text,
                          background: T.sidebar, border: `1px solid ${alpha(T.border, 30)}`,
                          whiteSpace: "nowrap", verticalAlign: "middle",
                        }}>
                          🔩 {ponte}
                        </td>
                        {cells}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      </div>

      {/* ── Duration picker modal ── */}
      {pending && (
        <DurationPicker
          onSelect={confirmDuration}
          onCancel={() => { setPending(null); loadPlan(); }}
        />
      )}

      {/* ── Order detail modal ── */}
      {selected && (
        <OrderModal
          order={selected.order}
          asgn={selected.asgn}
          onClose={() => setSelected(null)}
          onSave={updateOrderStatus}
        />
      )}
    </div>
  );
}

// ── Style constants ───────────────────────────────────────────────────────────
const navBtn = {
  background: "transparent", border: `1px solid var(--t-border)`, borderRadius: 7,
  color: "var(--t-text-sub)", cursor: "pointer", padding: "6px 10px",
  display: "flex", alignItems: "center",
};

const thStyle = {
  padding: "8px 6px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "var(--t-text-sub)", textTransform: "uppercase", letterSpacing: 0.5,
  borderBottom: `2px solid var(--t-border)`, whiteSpace: "nowrap",
  background: "var(--t-sidebar)",
};
