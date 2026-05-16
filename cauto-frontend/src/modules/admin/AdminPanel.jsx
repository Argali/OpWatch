import React, { useState, useEffect, useCallback } from "react";
import T, { alpha, roleLabel, moduleLabel, levelColor } from "@/theme";
import { useAuth } from "@/core/auth/AuthContext";
import { usePerms } from "@/core/permissions/PermContext";
import { API } from "@/api";
import { useApi } from "@/hooks/useApi";
import TabBar from "@/shared/ui/TabBar";
import Spinner from "@/shared/ui/Spinner";

// ─── Audit log helpers ───────────────────────────────────────────────────────
const ACTION_COLOR = {
  CREATE: "#22c55e",
  UPDATE: "#3b82f6",
  DELETE: "#ef4444",
  ASSIGN: "#f59e0b",
  APPROVE:"#a855f7",
  EXPORT: "#64748b",
};

const ACTION_LABEL = {
  CREATE: "Creato",
  UPDATE: "Modificato",
  DELETE: "Eliminato",
  ASSIGN: "Assegnato",
  APPROVE:"Approvato",
  EXPORT: "Esportato",
};

function fmtDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminPanel(){
  const {auth}=useAuth();
  const {matrix,roles,levels,modules:apiModules,loadPerms}=usePerms();
  const [activeTab,setActiveTab]=useState("permissions");

  // Permissions tab state
  const [localMatrix,setLocalMatrix]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState(null);

  // Users tab state
  const [users,setUsers]=useState([]);
  const [usersLoading,setUsersLoading]=useState(false);
  const [showNewUser,setShowNewUser]=useState(false);
  const [newUser,setNewUser]=useState({name:"",email:"",password:"",role:"coordinatore_operativo"});
  const [userMsg,setUserMsg]=useState(null);

  // Ponti officina state
  const {data:pontiRemote,refetch:refetchPonti}=useApi("/workshop/ponti");
  const [ponti,setPonti]=useState(null);
  const [newPonte,setNewPonte]=useState("");
  const [editIdx,setEditIdx]=useState(null);
  const [editVal,setEditVal]=useState("");
  const [pontiMsg,setPontiMsg]=useState(null);
  const [savingPonti,setSavingPonti]=useState(false);
  useEffect(()=>{if(pontiRemote!==null&&ponti===null)setPonti(pontiRemote);},[pontiRemote]);

  const savePonti=async(next)=>{
    setSavingPonti(true);setPontiMsg(null);
    try{
      const r=await fetch(`${API}/workshop/ponti`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({ponti:next})});
      const d=await r.json();
      if(d.ok){setPonti(d.data);refetchPonti();setPontiMsg({ok:true,text:"Ponti aggiornati"});}
      else setPontiMsg({ok:false,text:d.error});
    }catch{setPontiMsg({ok:false,text:"Errore di rete"});}
    setSavingPonti(false);setTimeout(()=>setPontiMsg(null),3000);
  };
  const addPonte=()=>{const v=newPonte.trim();if(!v)return;const next=[...(ponti??[]),v];setPonti(next);setNewPonte("");savePonti(next);};
  const removePonte=i=>{const next=(ponti??[]).filter((_,idx)=>idx!==i);setPonti(next);savePonti(next);};
  const startEdit=(i,v)=>{setEditIdx(i);setEditVal(v);};
  const confirmEdit=()=>{
    if(!editVal.trim()){setEditIdx(null);return;}
    const next=(ponti??[]).map((p,i)=>i===editIdx?editVal.trim():p);
    setPonti(next);setEditIdx(null);savePonti(next);
  };

  // Audit log tab state
  const [logs,setLogs]=useState([]);
  const [logsLoading,setLogsLoading]=useState(false);
  const [logsError,setLogsError]=useState(null);
  const [logFilterModule,setLogFilterModule]=useState("");
  const [logFilterAction,setLogFilterAction]=useState("");
  const [logSearch,setLogSearch]=useState("");

  // Tenant modules — filter the API-driven list by what this tenant has enabled
  const tenantModules = auth?.tenant?.modules || {};
  const hasModuleConfig = Object.keys(tenantModules).length > 0;
  const modules = hasModuleConfig
    ? apiModules.filter(m => tenantModules[m])
    : apiModules;

  useEffect(()=>{ if(matrix)setLocalMatrix(JSON.parse(JSON.stringify(matrix))); },[matrix]);

  const loadUsers=useCallback(async()=>{
    setUsersLoading(true);
    const res=await fetch(`${API}/admin/users`,{headers:{Authorization:`Bearer ${auth.token}`}});
    const d=await res.json();if(d.ok)setUsers(d.data);
    setUsersLoading(false);
  },[auth.token]);

  const loadLogs=useCallback(async()=>{
    setLogsLoading(true);
    setLogsError(null);
    try{
      const params=new URLSearchParams({limit:300});
      if(logFilterModule)params.set("module",logFilterModule);
      if(logFilterAction)params.set("action",logFilterAction);
      const res=await fetch(`${API}/audit-logs?${params}`,{headers:{Authorization:`Bearer ${auth.token}`}});
      const d=await res.json();
      if(d.ok)setLogs(d.data);
      else setLogsError(d.error||"Errore nel caricamento");
    }catch{
      setLogsError("Errore di rete");
    }
    setLogsLoading(false);
  },[auth.token,logFilterModule,logFilterAction]);

  useEffect(()=>{ if(activeTab==="users")loadUsers(); },[activeTab,loadUsers]);
  useEffect(()=>{ if(activeTab==="logs")loadLogs(); },[activeTab,loadLogs]);

  const saveMatrix=async()=>{
    setSaving(true);setSaveMsg(null);
    try{
      const res=await fetch(`${API}/permissions`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({matrix:localMatrix})});
      const d=await res.json();
      if(d.ok){setSaveMsg({ok:true,text:"Permessi salvati"});loadPerms();}
      else setSaveMsg({ok:false,text:d.error});
    }catch{setSaveMsg({ok:false,text:"Errore di rete"});}
    setSaving(false);setTimeout(()=>setSaveMsg(null),3000);
  };

  const setLevel=(role,mod,level)=>setLocalMatrix(m=>({...m,[role]:{...m[role],[mod]:level}}));

  const createUser=async()=>{
    if(!newUser.name||!newUser.email||!newUser.password){setUserMsg({ok:false,text:"Tutti i campi sono obbligatori"});return;}
    const res=await fetch(`${API}/admin/users`,{method:"POST",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify(newUser)});
    const d=await res.json();
    if(d.ok){setUserMsg({ok:true,text:"Utente creato"});setShowNewUser(false);setNewUser({name:"",email:"",password:"",role:"coordinatore_operativo"});loadUsers();}
    else setUserMsg({ok:false,text:d.error});
    setTimeout(()=>setUserMsg(null),3000);
  };

  const toggleUser=async(id,active)=>{
    const r=await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({active})});
    const d=await r.json();if(d.ok)loadUsers();else setUserMsg({ok:false,text:d.error||"Errore aggiornamento utente"});
  };
  const changeRole=async(id,role)=>{
    const r=await fetch(`${API}/admin/users/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${auth.token}`,"Content-Type":"application/json"},body:JSON.stringify({role})});
    const d=await r.json();if(d.ok)loadUsers();else setUserMsg({ok:false,text:d.error||"Errore aggiornamento ruolo"});
  };

  const inp={width:"100%",background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 12px",color:T.text,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.font};
  const selStyle={background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 10px",color:T.text,fontSize:12,outline:"none",fontFamily:T.font,cursor:"pointer"};

  // Filtered logs (client-side text search on top of server filters)
  const visibleLogs = logs.filter(l => {
    if(!logSearch)return true;
    const q=logSearch.toLowerCase();
    return (
      (l.entityLabel||"").toLowerCase().includes(q)||
      (l.userEmail||"").toLowerCase().includes(q)||
      (l.fieldChanged||"").toLowerCase().includes(q)||
      (l.notes||"").toLowerCase().includes(q)
    );
  });

  const adminTabs=[
    {id:"permissions",label:"Permessi",  icon:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"},
    {id:"users",      label:"Utenti",    icon:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"},
    {id:"officina",   label:"Officina",  icon:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"},
    {id:"logs",       label:"Log attività", icon:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8"},
  ];

  return(
    <div style={{fontFamily:T.font}}>
      <TabBar tabs={adminTabs} active={activeTab} onChange={setActiveTab}/>

      {/* ── PERMESSI ── */}
      {activeTab==="permissions"&&localMatrix&&(
        <div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr>
                  <th style={{padding:"12px 16px",textAlign:"left",color:T.textSub,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5,borderBottom:`1px solid ${T.border}`}}>Modulo</th>
                  {roles.map(r=><th key={r} style={{padding:"12px 16px",textAlign:"center",color:T.textSub,fontWeight:600,fontSize:11,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{roleLabel[r]||r}</th>)}
                </tr>
              </thead>
              <tbody>
                {modules.map(mod=>(
                  <tr key={mod} style={{borderBottom:`1px solid ${alpha(T.border,13)}`}}>
                    <td style={{padding:"14px 16px",color:T.text,fontWeight:600}}>{moduleLabel[mod]||mod}</td>
                    {roles.map(role=>{
                      const current=localMatrix[role]?.[mod]||"none";
                      return(
                        <td key={role} style={{padding:"8px 16px",textAlign:"center"}}>
                          <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap"}}>
                            {levels.map(lvl=>(
                              <button key={lvl} onClick={()=>setLevel(role,mod,lvl)}
                                style={{padding:"4px 9px",fontSize:10,borderRadius:6,cursor:"pointer",fontFamily:T.font,fontWeight:current===lvl?700:400,background:current===lvl?levelColor[lvl]+"33":"transparent",border:`1px solid ${current===lvl?levelColor[lvl]:T.border}`,color:current===lvl?levelColor[lvl]:T.textDim,transition:"all 0.1s"}}>
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:18}}>
            <button onClick={saveMatrix} disabled={saving} style={{padding:"10px 22px",background:T.navActive,border:`1px solid ${alpha(T.blue,33)}`,borderRadius:8,color:T.blue,cursor:saving?"not-allowed":"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
              {saving?"Salvando...":"💾 Salva e applica"}
            </button>
            {saveMsg&&<div style={{fontSize:13,color:saveMsg.ok?T.green:T.red}}>{saveMsg.text}</div>}
          </div>
          <div style={{display:"flex",gap:16,marginTop:14}}>
            {[["none","Nessun accesso"],["view","Solo lettura"],["edit","Modifica"],["full","Accesso completo"]].map(([l,desc])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:T.textSub}}>
                <div style={{width:8,height:8,borderRadius:2,background:levelColor[l]}}/>{desc}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── UTENTI ── */}
      {activeTab==="users"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,color:T.textSub}}>{users.length} utenti</div>
            <button onClick={()=>setShowNewUser(v=>!v)} style={{padding:"9px 16px",background:T.navActive,border:`1px solid ${alpha(T.blue,33)}`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>
              {showNewUser?"✕ Annulla":"+ Nuovo utente"}
            </button>
          </div>
          {userMsg&&<div style={{fontSize:13,padding:"10px 14px",borderRadius:8,background:userMsg.ok?T.card:"#1a0808",border:`1px solid ${userMsg.ok?T.border:"#4a1a1a"}`,color:userMsg.ok?T.green:T.red}}>{userMsg.text}</div>}
          {showNewUser&&(
            <div style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:18,display:"flex",flexDirection:"column",gap:12}}>
              <div style={{fontSize:14,color:T.text,fontWeight:600}}>Nuovo utente</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[["Nome","text",newUser.name,v=>setNewUser(u=>({...u,name:v}))],["Email","email",newUser.email,v=>setNewUser(u=>({...u,email:v}))],["Password","password",newUser.password,v=>setNewUser(u=>({...u,password:v}))]].map(([label,type,val,set])=>(
                  <div key={label}>
                    <label style={{fontSize:11,color:T.textSub,display:"block",marginBottom:5,fontWeight:600}}>{label}</label>
                    <input type={type} value={val} onChange={e=>set(e.target.value)} style={inp}/>
                  </div>
                ))}
                <div>
                  <label style={{fontSize:11,color:T.textSub,display:"block",marginBottom:5,fontWeight:600}}>Ruolo</label>
                  <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))} style={inp}>
                    {roles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={createUser} style={{alignSelf:"flex-start",padding:"9px 18px",background:T.navActive,border:`1px solid ${alpha(T.blue,33)}`,borderRadius:8,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600}}>Crea utente</button>
            </div>
          )}
          {usersLoading?<Spinner/>:
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {users.map(u=>(
                <div key={u.id} style={{background:T.card,border:`1px solid ${T.cardBorder}`,borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:12,opacity:u.active?1:0.5,boxShadow:"0 1px 4px rgba(0,0,0,0.1)"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.text}}>{u.name}</div>
                    <div style={{fontSize:11,color:T.textSub,marginTop:2}}>{u.email}</div>
                  </div>
                  <select value={u.role} onChange={e=>changeRole(u.id,e.target.value)} style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 8px",color:T.text,fontSize:11,outline:"none",fontFamily:T.font,cursor:"pointer"}}>
                    {roles.map(r=><option key={r} value={r}>{roleLabel[r]||r}</option>)}
                  </select>
                  <div style={{width:8,height:8,borderRadius:"50%",background:u.active?T.green:T.textDim,flexShrink:0}}/>
                  <button onClick={()=>toggleUser(u.id,!u.active)} style={{fontSize:12,padding:"5px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,color:u.active?T.red:T.green,cursor:"pointer",fontFamily:T.font}}>
                    {u.active?"Disattiva":"Riattiva"}
                  </button>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* ── OFFICINA ── */}
      {activeTab==="officina"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16,marginTop:16}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:T.text}}>Ponti sollevatori</div>
            <div style={{fontSize:11,color:T.textSub,marginTop:2}}>Configura i ponti disponibili in officina. Saranno assegnabili alle segnalazioni.</div>
          </div>

          {pontiMsg&&<div style={{fontSize:12,padding:"8px 12px",borderRadius:7,background:pontiMsg.ok?T.card:"#1a0808",border:`1px solid ${pontiMsg.ok?T.border:"#4a1a1a"}`,color:pontiMsg.ok?T.green:T.red}}>{pontiMsg.text}</div>}

          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {(ponti??[]).length===0&&<div style={{fontSize:12,color:T.textDim,fontStyle:"italic"}}>Nessun ponte configurato</div>}
            {(ponti??[]).map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 12px"}}>
                <span style={{fontSize:13,color:T.blue,flexShrink:0}}>🔩</span>
                {editIdx===i
                  ?<input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")confirmEdit();if(e.key==="Escape")setEditIdx(null);}}
                      style={{flex:1,background:"transparent",border:"none",outline:"none",color:T.text,fontSize:13,fontFamily:T.font}}/>
                  :<span style={{flex:1,fontSize:13,color:T.text}}>{p}</span>
                }
                {editIdx===i
                  ?<button onClick={confirmEdit} style={{fontSize:11,padding:"3px 10px",background:"transparent",border:`1px solid ${T.green}`,borderRadius:5,color:T.green,cursor:"pointer",fontFamily:T.font}}>✓ Salva</button>
                  :<button onClick={()=>startEdit(i,p)} style={{fontSize:11,padding:"3px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:5,color:T.textSub,cursor:"pointer",fontFamily:T.font}}>Rinomina</button>
                }
                <button onClick={()=>removePonte(i)} disabled={savingPonti}
                  style={{fontSize:11,padding:"3px 10px",background:"transparent",border:`1px solid ${alpha(T.red,40)}`,borderRadius:5,color:T.red,cursor:"pointer",fontFamily:T.font}}>✕</button>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:8}}>
            <input value={newPonte} onChange={e=>setNewPonte(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")addPonte();}}
              placeholder="Nome nuovo ponte…"
              style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 12px",color:T.text,fontSize:13,outline:"none",fontFamily:T.font}}/>
            <button onClick={addPonte} disabled={!newPonte.trim()||savingPonti}
              style={{padding:"8px 16px",background:T.navActive,border:`1px solid ${alpha(T.blue,33)}`,borderRadius:7,color:T.blue,cursor:"pointer",fontSize:13,fontFamily:T.font,fontWeight:600,opacity:!newPonte.trim()?0.5:1}}>
              + Aggiungi
            </button>
          </div>
        </div>
      )}

      {/* ── LOG ATTIVITÀ ── */}
      {activeTab==="logs"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Filter bar */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <input
              placeholder="Cerca per utente, entità, campo..."
              value={logSearch}
              onChange={e=>setLogSearch(e.target.value)}
              style={{...inp,width:260,padding:"7px 12px"}}
            />
            <select value={logFilterModule} onChange={e=>setLogFilterModule(e.target.value)} style={selStyle}>
              <option value="">Tutti i moduli</option>
              {["workshop","permissions","users","planning","gps","fuel"].map(m=>(
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select value={logFilterAction} onChange={e=>setLogFilterAction(e.target.value)} style={selStyle}>
              <option value="">Tutte le azioni</option>
              {["CREATE","UPDATE","DELETE","ASSIGN","APPROVE","EXPORT"].map(a=>(
                <option key={a} value={a}>{ACTION_LABEL[a]||a}</option>
              ))}
            </select>
            <button onClick={loadLogs} style={{padding:"7px 14px",background:T.navActive,border:`1px solid ${alpha(T.blue,33)}`,borderRadius:6,color:T.blue,cursor:"pointer",fontSize:12,fontFamily:T.font,fontWeight:600}}>
              ↻ Aggiorna
            </button>
            <div style={{marginLeft:"auto",fontSize:12,color:T.textSub}}>
              {visibleLogs.length} eventi
            </div>
          </div>

          {/* Log table */}
          {logsLoading ? <Spinner/> : logsError ? (
            <div style={{fontSize:13,color:T.red,padding:"12px 16px",background:"#1a0808",borderRadius:8,border:"1px solid #4a1a1a"}}>{logsError}</div>
          ) : visibleLogs.length===0 ? (
            <div style={{fontSize:13,color:T.textSub,padding:"32px",textAlign:"center"}}>Nessun evento trovato</div>
          ) : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr>
                    {["Data/Ora","Utente","Azione","Modulo","Entità","Campo","Da → A","Note"].map(h=>(
                      <th key={h} style={{padding:"10px 12px",textAlign:"left",color:T.textSub,fontWeight:600,fontSize:10,textTransform:"uppercase",letterSpacing:0.5,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleLogs.map(log=>(
                    <tr key={log.id} style={{borderBottom:`1px solid ${alpha(T.border,10)}`,transition:"background 0.1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=alpha(T.blue,5)}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"10px 12px",color:T.textSub,whiteSpace:"nowrap"}}>{fmtDate(log.timestamp)}</td>
                      <td style={{padding:"10px 12px",color:T.text,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={log.userEmail}>
                        <div style={{fontWeight:600,fontSize:11}}>{log.userRole||"—"}</div>
                        <div style={{color:T.textSub,fontSize:10,marginTop:1}}>{log.userEmail||"—"}</div>
                      </td>
                      <td style={{padding:"10px 12px"}}>
                        <span style={{padding:"3px 8px",borderRadius:5,fontSize:10,fontWeight:700,background:alpha(ACTION_COLOR[log.action]||T.textSub,20),color:ACTION_COLOR[log.action]||T.textSub,whiteSpace:"nowrap"}}>
                          {ACTION_LABEL[log.action]||log.action||"—"}
                        </span>
                      </td>
                      <td style={{padding:"10px 12px",color:T.textSub,fontSize:11}}>{log.module||"—"}</td>
                      <td style={{padding:"10px 12px",color:T.text,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={log.entityLabel}>
                        {log.entityLabel||"—"}
                      </td>
                      <td style={{padding:"10px 12px",color:T.textSub,fontFamily:"monospace",fontSize:11}}>{log.fieldChanged||"—"}</td>
                      <td style={{padding:"10px 12px",maxWidth:200}}>
                        {log.fieldChanged ? (
                          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                            <span style={{padding:"2px 7px",borderRadius:4,background:alpha(T.red,15),color:T.red,fontSize:10,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={log.oldValue}>
                              {log.oldValue||"—"}
                            </span>
                            <span style={{color:T.textDim,fontSize:10}}>→</span>
                            <span style={{padding:"2px 7px",borderRadius:4,background:alpha(T.green,15),color:T.green,fontSize:10,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={log.newValue}>
                              {log.newValue||"—"}
                            </span>
                          </div>
                        ) : <span style={{color:T.textDim}}>—</span>}
                      </td>
                      <td style={{padding:"10px 12px",color:T.textSub,fontSize:11,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={log.notes}>
                        {log.notes||"—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
