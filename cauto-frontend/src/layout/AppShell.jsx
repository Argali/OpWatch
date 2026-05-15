import React, { useState, useEffect, lazy, Suspense } from "react";
import { msalInstance } from "@/msalConfig.js";
import { API } from "@/api";
import T from "@/theme";
import { useAuth } from "@/core/auth";
import FleetLogo from "@/shared/ui/FleetLogo";

const LoginScreen = lazy(() => import("@/modules/dashboard/LoginScreen"));
const Dashboard   = lazy(() => import("@/modules/dashboard/Dashboard"));

const Splash = () => (
  <div style={{ height: "100vh", background: T.sidebar, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font, color: T.textSub, fontSize: 13 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <FleetLogo size={28} />
      <span>Caricamento...</span>
    </div>
  </div>
);

export default function AppShell() {
  const { auth, login } = useAuth();
  const [redirecting, setRedirecting] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // Only clear stale interaction locks when there is no active redirect response.
    // MSAL v5 defaults to response_mode=fragment, so the code arrives in the URL
    // hash (#code=...), not the query string. Clearing interaction.status before
    // handleRedirectPromise causes MSAL to return null and silently drop the result.
    const loc = window.location.search + window.location.hash;
    const hasRedirectResponse = loc.includes("code=") || loc.includes("error=");
    if (!hasRedirectResponse) {
      Object.keys(sessionStorage)
        .filter(k => k.includes("interaction.status"))
        .forEach(k => sessionStorage.removeItem(k));
    }

    msalInstance.initialize()
      .then(() => msalInstance.handleRedirectPromise())
      .then(async result => {
        if (result?.idToken) {
          let data;
          try {
            const res = await fetch(`${API}/auth/azure`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ms_token: result.idToken }),
            });
            data = await res.json();
          } catch (err) {
            console.error("[Auth] Network error contacting backend:", err);
            setAuthError("Impossibile raggiungere il server. Controlla la connessione o riprova.");
            return;
          }
          if (data.ok) {
            login(data.token, data.user, data.tenant);
          } else {
            console.error("[Auth] Backend rejected token:", data.error);
            setAuthError(data.error || "Accesso non riuscito. Riprova.");
          }
        }
      })
      .catch(err => {
        console.error("[Auth] MSAL redirect error:", err);
        setAuthError(err?.message || "Errore durante l'accesso Microsoft. Riprova.");
      })
      .finally(() => setRedirecting(false));
  }, [login]);

  if (redirecting) return <Splash />;

  return (
    <Suspense fallback={<Splash />}>
      {auth ? <Dashboard /> : <LoginScreen authError={authError} />}
    </Suspense>
  );
}
