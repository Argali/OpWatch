# VisiRun Integration — Setup Guide

## Prerequisites

1. **API key** — already obtained from VisiRun helpdesk (`helpdesk@visirun.com`)
2. **IP allowlisting** — the Worker's outbound IP must be registered with VisiRun

---

## Step 1 — Find the Cloudflare Worker outbound IP

VisiRun rejects all requests from non-registered IPs with error `100`.
You need to send Cloudflare's outbound IP(s) to VisiRun before the integration works.

Cloudflare Workers use a shared pool of egress IPs. You can find the current range at:
**https://www.cloudflare.com/ips/** — use the IPv4 list.

Alternatively, deploy the Worker and make a test request through it to a service like
`https://api.ipify.org` to capture the actual egress IP used.

---

## Step 2 — Email VisiRun to register the IPs

Send an email to `helpdesk@visirun.com`:

```
Subject: IP allowlisting request — OpSonata integration

Hi,

We would like to register the following IP addresses to use with our API key:

  <paste Cloudflare egress IPs here>

Company: <your company name>
API key: <your key>

Thank you.
```

Allowlisting typically takes 1–2 business days.

---

## Step 3 — Add environment variables in Cloudflare

In the Cloudflare dashboard → Workers & Pages → `opsonata-worker` → **Settings → Variables**,
add these as **Secrets**:

| Variable | Value |
|----------|-------|
| `GPS_PROVIDER` | `visirun` |
| `VISIRUN_API_KEY` | your key from VisiRun |

**Do not commit your API key to git.** It lives only in Cloudflare's secret store.

---

## Step 4 — Deploy and verify

After saving the secrets, redeploy the Worker:

```bash
cd cauto-worker && npx wrangler deploy
```

Verify with a quick curl (replace the token with a valid JWT):

```bash
curl https://opsonata-worker.<your-account>.workers.dev/api/gps/vehicles \
  -H "Authorization: Bearer <your_token>"
```

Expected: `{ "ok": true, "data": [ { "id": "...", "name": "...", ... } ] }`

If you see `{ "ok": false, "error": "[VisiRun] SOAP fault..." }` or a 500 error,
check the Worker logs in the Cloudflare dashboard (Workers → opsonata-worker → Logs).

---

## Available endpoints (after activation)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gps/vehicles` | Live positions of all fleet vehicles (cached 30 s) |
| GET | `/api/gps/history/:plate?date=yyyy-mm-dd` | Full-day GPS track for one vehicle |
| GET | `/api/gps/stops/:plate?start=...&end=...` | Stop list (max 7-day window, UTC timestamps) |
| GET | `/api/gps/kpi?date=yyyy-mm-dd` | Daily KPIs (distance, fuel, drive time) per vehicle |
| GET | `/api/gps/odometer` | Cumulative km + engine hours for all vehicles |

The `start`/`end` parameters for `/stops` use the format `yyyy-mm-dd hh:mm:ss` (UTC).

---

## Rate limits to be aware of

| Endpoint | Daily limit | Min interval |
|----------|-------------|--------------|
| `getFleetCurrentPosition` (vehicles) | 1 000 / day | 1 s |
| `getRoute` (history) | 1 000 / day | 1 s |
| `getStops` | 100 / vehicle | 5 min same vehicle |
| `getFleetKpi` | 1 000 / day | 1 s |
| `getFleetOdometer` | 1 000 / day | 1 s |

The vehicle positions endpoint is cached for **30 seconds** server-side, so the
frontend polling every 10 s makes at most ~2 880 SOAP calls per day — well within limits.

---

## Fallback

At any point you can revert to mock data without code changes:

```
GPS_PROVIDER=mock   ← set this in Cloudflare Worker secrets/vars
```

The mock adapter returns in-memory demo vehicles. All other endpoints still work.
