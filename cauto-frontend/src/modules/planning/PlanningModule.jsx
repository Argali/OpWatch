import React, { useRef, useEffect, useCallback, useState } from "react";
import { useAuth } from "@/core/auth/AuthContext";
import { API } from "@/api";

/**
 * PlanningModule — embeds planning.html in an iframe and passes the JWT via
 * postMessage so the planning tool can call /api/planning/vehicles for live
 * vehicle data while events remain in localStorage for Phase 1.
 */
export default function PlanningModule() {
  const { auth } = useAuth();
  const iframeRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const sendAuth = useCallback(() => {
    if (!iframeRef.current || !auth?.token) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type:    "OpSonata_AUTH",
        token:   auth.token,
        apiBase: API,
      },
      window.location.origin
    );
  }, [auth?.token]);

  // Listen for PLANNING_READY from the iframe, then send auth
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "PLANNING_READY") {
        setReady(true);
        sendAuth();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendAuth]);

  // Re-send auth if token rotates while iframe is already loaded
  useEffect(() => {
    if (ready) sendAuth();
  }, [ready, sendAuth]);

  const handleIframeError = () => {
    setError("Impossibile caricare lo strumento di pianificazione.");
  };

  if (error) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", color: "#f87171", fontSize: 13, fontFamily: "monospace",
      }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {!ready && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "#060f06", color: "#2a5a2a", fontSize: 12,
          fontFamily: "monospace", zIndex: 1,
        }}>
          Caricamento pianificazione…
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={`${import.meta.env.BASE_URL}/planning.html`.replace(/\/+/g, "/")}
        title="Pianificazione"
        onError={handleIframeError}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          // Slight fade-in once the tool signals it's ready
          opacity: ready ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
        allow="clipboard-write"
      />
    </div>
  );
}
