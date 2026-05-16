import React, { useRef, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import "leaflet-easyprint";
import "leaflet-toolbar";
import "leaflet-toolbar/dist/leaflet.toolbar.css";
import "leaflet-openweathermap";
import "leaflet-openweathermap/leaflet-openweathermap.css";
import { BurgerMenuControl } from "leaflet-burgermenu";
import "leaflet-burgermenu/dist/leaflet-burgermenu.css";
import T, { statusColor, statusLabel } from "@/theme";
import Icon from "@/shared/ui/Icon";

// Inject pulsing-dot CSS once
let _geoCssInjected = false;
function injectGeoCss() {
  if (_geoCssInjected) return;
  _geoCssInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes OpSonata-pulse {
      0%   { transform: scale(1);   opacity: 0.6; }
      70%  { transform: scale(2.4); opacity: 0;   }
      100% { transform: scale(1);   opacity: 0;   }
    }
    .OpSonata-my-pos-ring {
      position: absolute; width: 20px; height: 20px;
      top: 0; left: 0; border-radius: 50%;
      background: rgba(96,165,250,0.35);
      animation: OpSonata-pulse 2s ease-out infinite;
    }
    .OpSonata-my-pos-dot {
      position: absolute; width: 14px; height: 14px;
      top: 3px; left: 3px; border-radius: 50%;
      background: #60a5fa; border: 2.5px solid #fff;
      box-shadow: 0 0 8px rgba(96,165,250,0.9);
    }
    /* ── Toolbar overrides for dark theme ── */
    .leaflet-control-toolbar ul { background: #0d1b2a; border: 1px solid #1e3a5a; border-radius: 8px; }
    .leaflet-toolbar-icon { background: transparent !important; color: #e2eaf5; font-size: 16px; line-height: 30px; width: 32px !important; height: 32px !important; }
    .leaflet-toolbar-icon:hover { background: #1e3a5a !important; border-radius: 4px; }
    /* ── Burger menu dark theme ── */
    .leaflet-control-burgermenu .burger-button { background: #0d1b2a; border: 1px solid #1e3a5a; color: #e2eaf5; font-size: 18px; padding: 6px 9px; border-radius: 6px; }
    .leaflet-control-burgermenu .burger-menu, .leaflet-control-burgermenu .burger-menu-item { background: #0d1b2a; border-color: #1e3a5a; color: #e2eaf5; font-size: 12px; }
    .leaflet-control-burgermenu .burger-menu-item:hover { background: #1e3a5a; }
    .leaflet-control-burgermenu .burger-menu.level-0 { max-height: 320px; overflow-y: auto; min-width: 200px; }
  `;
  document.head.appendChild(s);
}

// ── Geo helpers ───────────────────────────────────────────────────────────────
function segDistM(a, b) {
  const R = 6371000, toRad = x => x * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}
function bearing(a, b) {
  return Math.atan2(b[1]-a[1], b[0]-a[0]) * 180 / Math.PI;
}
function addArrows(waypoints, color, layer, intervalM=500) {
  let dist=0, nextAt=intervalM/2;
  for(let i=0;i<waypoints.length-1;i++){
    const a=waypoints[i],b=waypoints[i+1];
    const seg=segDistM(a,b);
    while(dist+seg>=nextAt){
      const t=(nextAt-dist)/seg;
      const lat=a[0]+t*(b[0]-a[0]),lng=a[1]+t*(b[1]-a[1]);
      const deg=bearing(a,b);
      L.marker([lat,lng],{
        icon:L.divIcon({
          className:"",
          html:`<div style="transform:rotate(${deg}deg);color:${color};font-size:15px;line-height:1;text-shadow:0 0 5px rgba(0,0,0,0.9);filter:drop-shadow(0 0 2px rgba(0,0,0,0.7))">▲</div>`,
          iconSize:[15,15],iconAnchor:[7,7],
        }),
        interactive:false,zIndexOffset:400,
      }).addTo(layer);
      nextAt+=intervalM;
    }
    dist+=seg;
  }
}
function renderSegmentedRoute(waypoints, transitSet, color, weight, opacity, layer) {
  if(!waypoints||waypoints.length<2)return;
  let runStart=0, runIsTransit=transitSet.has(0);
  for(let i=1;i<=waypoints.length-1;i++){
    const nextTransit=transitSet.has(i);
    if(i===waypoints.length-1||nextTransit!==runIsTransit){
      const pts=waypoints.slice(runStart,i+1);
      if(pts.length>=2)L.polyline(pts,{color,weight,opacity,dashArray:runIsTransit?"10 6":null}).addTo(layer);
      runStart=i; runIsTransit=nextTransit;
    }
  }
}

// ── Toolbar action factory ────────────────────────────────────────────────────
function makeAction(html, tooltip, cbRef, cbKey) {
  return L.Toolbar2.Action.extend({
    options: { toolbarIcon: { html, tooltip } },
    addHooks() { cbRef.current?.[cbKey]?.(); this.disable(); },
  });
}

function FleetMap({
  vehicles, routes, visibleRoutes, editMode, editWaypoints, editColor,
  zones, punti, onMapClick, onWaypointMove, onWaypointDelete,
  searchMarkerRef, easyPrintRef, snappedSegments, snapMode,
  onPathClick, annotations=[], myPosition, driverLocations,
  // new plugin props
  owmApiKey, weatherLayers, editorActive, toolbarCbRef,
  routeProgress,
  // transit / arrows props
  transitMode, transitRange, onWaypointSelect, editTransitSegments,
}) {
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const routeLayerRef=useRef(null);
  const vehicleLayerRef=useRef(null);
  const editLayerRef=useRef(null);
  const zoneLayerRef=useRef(null);
  const puntiLayerRef=useRef(null);
  const annotLayerRef=useRef(null);
  const myPosLayerRef=useRef(null);
  const driverLocsLayerRef=useRef(null);
  const owmLayersRef=useRef({temp:null,rain:null,wind:null});
  const burgerMenuRef=useRef(null);
  const toolbarCtrlRef=useRef(null);
  const cbClick=useRef(onMapClick);
  const cbMove=useRef(onWaypointMove);
  const cbDel=useRef(onWaypointDelete);
  const cbPathClick=useRef(onPathClick);
  const cbWpSelect=useRef(onWaypointSelect);
  useEffect(()=>{cbClick.current=onMapClick;},[onMapClick]);
  useEffect(()=>{cbMove.current=onWaypointMove;},[onWaypointMove]);
  useEffect(()=>{cbDel.current=onWaypointDelete;},[onWaypointDelete]);
  useEffect(()=>{cbPathClick.current=onPathClick;},[onPathClick]);
  useEffect(()=>{cbWpSelect.current=onWaypointSelect;},[onWaypointSelect]);

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!containerRef.current||mapRef.current)return;
    injectGeoCss();
    const map=L.map(containerRef.current,{center:[44.835,11.619],zoom:13});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(map);
    routeLayerRef.current=L.layerGroup().addTo(map);
    zoneLayerRef.current=L.layerGroup().addTo(map);
    puntiLayerRef.current=L.layerGroup().addTo(map);
    annotLayerRef.current=L.layerGroup().addTo(map);
    vehicleLayerRef.current=L.markerClusterGroup({
      maxClusterRadius:60,
      showCoverageOnHover:false,
      spiderfyOnMaxZoom:true,
      disableClusteringAtZoom:16,
    }).addTo(map);
    myPosLayerRef.current=L.layerGroup().addTo(map);
    driverLocsLayerRef.current=L.layerGroup().addTo(map);
    editLayerRef.current=L.layerGroup().addTo(map);
    map.on("click",(e)=>{ if(cbClick.current)cbClick.current([e.latlng.lat,e.latlng.lng]); });
    mapRef.current=map;

    // easyPrint
    if(searchMarkerRef)searchMarkerRef.current=map;
    if(easyPrintRef){
      const ep=L.easyPrint({hidden:true,sizeModes:["A4Portrait","A4Landscape"],filename:"OpSonata_map",hideControlContainer:true}).addTo(map);
      easyPrintRef.current=ep;
    }

    // OWM weather layers (created but not added — toggled via weatherLayers prop)
    if(owmApiKey){
      try{
        owmLayersRef.current.temp=L.OWM.temperature({appId:owmApiKey,temperatureUnit:"C",opacity:0.65,showLegend:false});
        owmLayersRef.current.rain=L.OWM.rain({appId:owmApiKey,opacity:0.65,showLegend:false});
        owmLayersRef.current.wind=L.OWM.wind({appId:owmApiKey,opacity:0.65,showLegend:false});
      }catch(e){ console.warn("OWM init error",e); }
    }

    return()=>{
      map.remove();
      mapRef.current=null;
      if(searchMarkerRef)searchMarkerRef.current=null;
      if(easyPrintRef)easyPrintRef.current=null;
      owmLayersRef.current={temp:null,rain:null,wind:null};
      burgerMenuRef.current=null;
      toolbarCtrlRef.current=null;
    };
  },[]);// eslint-disable-line

  // ── Weather layer toggle ────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current)return;
    const map=mapRef.current;
    const{temp,rain,wind}=owmLayersRef.current;
    const toggle=(layer,on)=>{
      if(!layer)return;
      if(on&&!map.hasLayer(layer))layer.addTo(map);
      else if(!on&&map.hasLayer(layer))map.removeLayer(layer);
    };
    toggle(temp,weatherLayers?.temp);
    toggle(rain,weatherLayers?.rain);
    toggle(wind,weatherLayers?.wind);
  },[weatherLayers]);

  // ── Burger menu: truck list (rebuilt when vehicles change) ──────────────────
  useEffect(()=>{
    if(!mapRef.current)return;
    const map=mapRef.current;
    if(burgerMenuRef.current){
      try{ burgerMenuRef.current.remove(); }catch{}
      burgerMenuRef.current=null;
    }
    const located=(vehicles||[]).filter(v=>v.lat&&v.lng);
    const items=located.map(v=>{
      const color=statusColor[v.status]||"#4ade80";
      return{
        title:`${v.name}  ·  ${v.plate}`,
        onClick:()=>{ map.flyTo([v.lat,v.lng],16); },
      };
    });
    burgerMenuRef.current=new BurgerMenuControl({
      position:"topright",
      title:"Camion",
      menuIcon:"🚛",
      menuItems:items,
    }).addTo(map);
  },[vehicles]);

  // ── Editor toolbar (shown only while editing a route) ──────────────────────
  useEffect(()=>{
    if(!mapRef.current)return;
    const map=mapRef.current;
    if(editorActive){
      if(!toolbarCtrlRef.current&&toolbarCbRef){
        const actions=[
          makeAction("↩","Annulla ultimo punto",toolbarCbRef,"undo"),
          makeAction("🗑","Cancella tutti i punti",toolbarCbRef,"clear"),
          makeAction("📌","Aggiungi annotazione",toolbarCbRef,"annotate"),
          makeAction("📝","Aggiungi testo ricco (Illustrate)",toolbarCbRef,"illustrate"),
        ];
        try{
          toolbarCtrlRef.current=new L.Toolbar2.Control({position:"topleft",actions}).addTo(map);
        }catch(e){ console.warn("Toolbar init error",e); }
      }
    } else {
      if(toolbarCtrlRef.current){
        try{ map.removeLayer(toolbarCtrlRef.current); }catch{}
        toolbarCtrlRef.current=null;
      }
    }
  },[editorActive,toolbarCbRef]);

  // ── Cursor ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current)return;
    mapRef.current.getContainer().style.cursor=editMode?"crosshair":"";
  },[editMode]);

  // ── Routes overlay ──────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!routes||!routeLayerRef.current)return;
    routeLayerRef.current.clearLayers();
    routes.forEach(r=>{
      const opacity=editMode?0.2:(visibleRoutes[r.id]?(r.opacity??0.85):0);
      if(opacity===0)return;
      const transitSet=new Set(r.transitSegments||[]);
      const prog=routeProgress&&routeProgress.id===r.id?routeProgress:null;
      if(prog&&prog.completedWaypoints.length>=2&&prog.remainingWaypoints.length>=2){
        const doneLine=L.polyline(prog.completedWaypoints,{color:r.color,weight:4,opacity:opacity*0.3});
        doneLine.bindTooltip(`<b>${r.name}</b> — ${prog.percent}% completato`,{sticky:true});
        routeLayerRef.current.addLayer(doneLine);
        const remLine=L.polyline(prog.remainingWaypoints,{color:r.color,weight:4,opacity});
        routeLayerRef.current.addLayer(remLine);
        const sp=prog.remainingWaypoints[0];
        if(sp){
          routeLayerRef.current.addLayer(L.marker(sp,{
            icon:L.divIcon({className:"",html:`<div style="background:${r.color};color:#fff;font-size:11px;font-weight:800;padding:3px 8px;border-radius:12px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.55);font-family:monospace">${prog.percent}%</div>`,iconSize:[46,22],iconAnchor:[23,11]}),
            zIndexOffset:600,interactive:false,
          }));
        }
      }else if(transitSet.size>0){
        renderSegmentedRoute(r.waypoints,transitSet,r.color,4,opacity,routeLayerRef.current);
        if(!editMode){
          const mid=r.waypoints[Math.floor(r.waypoints.length/2)];
          if(mid)L.marker(mid,{icon:L.divIcon({className:"",html:"",iconSize:[0,0]}),interactive:false}).bindTooltip(`<b>${r.name}</b>${r.comune?`<br>${r.comune}`:""}`,{sticky:true}).addTo(routeLayerRef.current);
        }
      }else{
        const line=L.polyline(r.waypoints,{color:r.color,weight:4,opacity,dashArray:r.status==="pianificato"?"10 7":null});
        if(!editMode)line.bindTooltip(`<b>${r.name}</b>${r.comune?`<br>${r.comune}`:""}`,{sticky:true});
        routeLayerRef.current.addLayer(line);
      }
      if(r.showArrows&&r.waypoints&&r.waypoints.length>=2&&opacity>0){
        addArrows(r.waypoints,r.color,routeLayerRef.current);
      }
    });
  },[routes,visibleRoutes,editMode,routeProgress]);

  // ── Zones overlay ───────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!zoneLayerRef.current)return;
    zoneLayerRef.current.clearLayers();
    (zones||[]).forEach(z=>{
      const style={fillColor:z.fillColor,fillOpacity:z.fillOpacity,color:z.borderColor,weight:2,opacity:1};
      let shape;
      if(z.type==="circle")shape=L.circle(z.center,{radius:z.radius,...style});
      else if(z.type==="square")shape=L.rectangle(z.bounds,style);
      else shape=L.polygon(z.vertices,style);
      if(z.name)shape.bindTooltip(z.name,{sticky:false});
      zoneLayerRef.current.addLayer(shape);
    });
  },[zones]);

  // ── Punti overlay ───────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!puntiLayerRef.current)return;
    puntiLayerRef.current.clearLayers();
    (punti||[]).forEach(p=>{
      const m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:"",html:`<div style="width:16px;height:16px;background:${p.color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.5)"></div>`,iconSize:[16,16],iconAnchor:[8,8]})});
      const sub=[p.comune,p.materiale,p.sector].filter(Boolean).join(" · ");
      if(p.nome||sub)m.bindTooltip(`<b>${p.nome||""}</b>${sub?`<br><span style="font-size:10px;color:#888">${sub}</span>`:""}`,{sticky:false});
      puntiLayerRef.current.addLayer(m);
    });
  },[punti]);

  // ── Annotations overlay (supports type="rich" from Illustrate) ──────────────
  useEffect(()=>{
    if(!mapRef.current||!annotLayerRef.current)return;
    annotLayerRef.current.clearLayers();
    (annotations||[]).forEach(a=>{
      if(!a.lat||!a.lng)return;
      const isRich=a.type==="rich";
      const html=isRich
        ?`<div style="background:${a.color||"#60a5fa"}22;color:#fff;padding:8px 14px;border-radius:8px;font-size:${a.fontSize||14}px;font-weight:600;border:2px solid ${a.color||"#60a5fa"};max-width:220px;line-height:1.5;box-shadow:0 2px 12px rgba(0,0,0,0.55);backdrop-filter:blur(6px);white-space:pre-wrap;">${a.text||"📝"}</div>`
        :`<div style="background:${a.color||"#facc15"};color:#000;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:1.5px solid rgba(0,0,0,0.3);max-width:160px;overflow:hidden;text-overflow:ellipsis;">${a.text||"📌"}</div>`;
      const m=L.marker([a.lat,a.lng],{
        icon:L.divIcon({className:"",html,iconAnchor:[0,isRich?0:10]}),
        interactive:false,
        zIndexOffset:2000,
      });
      annotLayerRef.current.addLayer(m);
    });
  },[annotations]);

  // ── Vehicles overlay ────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!vehicles||!vehicleLayerRef.current)return;
    vehicleLayerRef.current.clearLayers();
    if(editMode)return;
    vehicles.forEach(v=>{
      const color=statusColor[v.status]||T.green;
      const m=L.marker([v.lat,v.lng],{
        icon:L.divIcon({
          className:"",
          html:`<div style="width:18px;height:18px;background:${color};border:2px solid rgba(0,0,0,0.7);border-radius:50%;box-shadow:0 1px 5px rgba(0,0,0,0.55)"></div>`,
          iconSize:[18,18],iconAnchor:[9,9],
        }),
      });
      m.bindPopup(`<div style="font-family:system-ui;font-size:12px;min-width:160px"><div style="font-weight:700;margin-bottom:4px">${v.name}</div><div style="color:#666;margin-bottom:6px">${v.plate} · ${v.sector}</div>${v.speed_kmh>0?`<div style="margin-bottom:4px">${v.speed_kmh} km/h</div>`:""}<div style="height:4px;background:#eee;border-radius:2px;margin-bottom:2px"><div style="height:100%;width:${v.fuel_pct}%;background:${v.fuel_pct<20?"#f87171":"#4ade80"};border-radius:2px"></div></div><div style="font-size:10px;color:#888">Carburante: ${v.fuel_pct}%</div></div>`);
      vehicleLayerRef.current.addLayer(m);
    });
  },[vehicles,editMode]);

  // ── Editor drawing overlay ──────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!editLayerRef.current)return;
    editLayerRef.current.clearLayers();
    if(!editMode||!editWaypoints||editWaypoints.length===0)return;
    const color=editColor||T.green;
    const transitSet=new Set(editTransitSegments||[]);

    // Draw path: split by transit segments for dashed/solid rendering
    if(snappedSegments){
      // Snapped mode: one L.polyline per snap segment, styled by transit
      const pathPts=snappedSegments.flat();
      const line=L.polyline(pathPts,{color,weight:4,opacity:0.9,interactive:true});
      if(cbPathClick.current){
        line.on("click",(e)=>{
          L.DomEvent.stopPropagation(e);
          const click=[e.latlng.lat,e.latlng.lng];
          let bestSeg=0,bestDist=Infinity;
          for(let i=0;i<editWaypoints.length-1;i++){
            const a=editWaypoints[i],b=editWaypoints[i+1];
            const dx=b[0]-a[0],dy=b[1]-a[1];
            const d2=dx*dx+dy*dy;
            let t=d2>0?((click[0]-a[0])*dx+(click[1]-a[1])*dy)/d2:0;
            t=Math.max(0,Math.min(1,t));
            const dist=Math.hypot(click[0]-(a[0]+t*dx),click[1]-(a[1]+t*dy));
            if(dist<bestDist){bestDist=dist;bestSeg=i;}
          }
          cbPathClick.current(bestSeg+1,click);
        });
      }
      editLayerRef.current.addLayer(line);
    } else if(transitSet.size>0){
      // Free-hand with transit segments: draw each segment individually
      for(let i=0;i<editWaypoints.length-1;i++){
        L.polyline([editWaypoints[i],editWaypoints[i+1]],{
          color,weight:4,opacity:0.9,
          dashArray:transitSet.has(i)?"10 6":null,
        }).addTo(editLayerRef.current);
      }
    } else {
      // Simple: one polyline
      L.polyline(editWaypoints,{color,weight:4,opacity:0.9}).addTo(editLayerRef.current);
    }

    // Waypoint markers
    editWaypoints.forEach((wp,idx)=>{
      const inRange=transitRange&&transitRange[0]!==null&&transitRange[1]!==null
        &&idx>=transitRange[0]&&idx<=transitRange[1];
      const isSelected=transitRange&&(transitRange[0]===idx||transitRange[1]===idx);
      const markerColor=isSelected?"#f97316":inRange?"#fb923c":color;
      const borderColor=isSelected?"#fff":inRange?"#f97316":"#000";
      const m=L.marker([wp[0],wp[1]],{
        icon:L.divIcon({className:"",html:`<div style="width:18px;height:18px;background:${markerColor};border:2px solid ${borderColor};border-radius:50%;cursor:${transitMode?"pointer":"grab"};box-shadow:0 0 6px rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#000">${idx+1}</div>`,iconSize:[18,18],iconAnchor:[9,9]}),
        draggable:!transitMode,zIndexOffset:1000,
      });
      if(!transitMode){
        m.on("dragend",(e)=>{ const{lat,lng}=e.target.getLatLng(); if(cbMove.current)cbMove.current(idx,[lat,lng]); });
      }
      if(transitMode){
        m.on("click",(e)=>{ L.DomEvent.stopPropagation(e); if(cbWpSelect.current)cbWpSelect.current(idx); });
      } else if(snapMode){
        m.on("contextmenu",(e)=>{ L.DomEvent.stopPropagation(e); if(cbDel.current)cbDel.current(idx); });
      } else {
        m.on("click",(e)=>{ L.DomEvent.stopPropagation(e); if(cbDel.current)cbDel.current(idx); });
      }
      editLayerRef.current.addLayer(m);
    });
  },[editMode,editWaypoints,editColor,snappedSegments,snapMode,transitMode,transitRange,editTransitSegments]);

  // ── My position — pulsing blue dot ─────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!myPosLayerRef.current)return;
    myPosLayerRef.current.clearLayers();
    if(!myPosition)return;
    const icon=L.divIcon({
      className:"",
      html:`<div style="position:relative;width:20px;height:20px"><div class="OpSonata-my-pos-ring"></div><div class="OpSonata-my-pos-dot"></div></div>`,
      iconSize:[20,20],iconAnchor:[10,10],
    });
    const m=L.marker(myPosition,{icon,zIndexOffset:3000,interactive:false});
    myPosLayerRef.current.addLayer(m);
  },[myPosition]);

  // ── Other drivers ───────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!driverLocsLayerRef.current)return;
    driverLocsLayerRef.current.clearLayers();
    (driverLocations||[]).forEach(d=>{
      const icon=L.divIcon({
        className:"",
        html:`<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center"><div style="width:16px;height:16px;background:#4ade80;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(74,222,128,0.7)"></div></div>`,
        iconSize:[22,22],iconAnchor:[11,11],
      });
      const m=L.marker([d.lat,d.lng],{icon,zIndexOffset:2500});
      m.bindTooltip(`<b>${d.name}</b><br><span style="font-size:10px;color:#888">Driver live</span>`,{sticky:false});
      driverLocsLayerRef.current.addLayer(m);
    });
  },[driverLocations]);

  return <div ref={containerRef} style={{height:"100%",width:"100%"}}/>;
}

export default FleetMap;
