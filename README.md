# Agri Web Portal — Soil Sensor Dashboard

A full-stack dashboard for a smart soil-sensing probe (pH, EC, VWC moisture,
temperature, NPK + GPS), built for Sri Lankan farming systems. It ingests
readings from field devices over HTTP, applies the SRS **Step 1 hard-rule
filter**, and visualises live values, trends and device locations across the
island's agro-ecological regions.

Built with TanStack Start (React 19, SSR), TanStack Query, TanStack Router,
Drizzle ORM + SQLite, Tailwind CSS v4 and shadcn-style components.

## Quick start

```bash
npm install
npm run db:push     # create the SQLite tables (dev.db)
npm run db:seed     # seed the 6-device demo fleet: 7 days @ 30-min readings
npm run dev          # http://localhost:3030
```

The seed creates six probes — Anuradhapura (DL1), Polonnaruwa command area
(DL1b), Ampara (DL2), Kandy (IL3), Ratnapura (WL2) and Badulla (IU3) — with
realistic soil chemistry per zone (command-area salinity, acidic tea soils,
paddy waterlogging, etc.) so every hard-rule flag is demonstrated.

## Dashboard

- **Live sensor cards** — pH, EC, moisture, temperature, N, P, K with the latest
  value, SRS target range, hard-rule status (OK / Watch / Alert), a colour-zoned
  range bar and a 24-h sparkline.
- **History trend charts** — 24 h / 3 d / 7 d per parameter, with watch/alert
  zone bands and hover tooltips (times in Asia/Colombo).
- **Device map** — stylised Sri Lanka map framed by the SRS GPS bounds
  (5.9–9.9 °N, 79.6–81.9 °E); markers are colour-coded by device status and
  clickable to switch the selected probe.
- **Simulate reading** — generates the next reading on a device's
  deterministic timeline (great for demos without hardware).
- Auto-refreshes every 30 s; unknown devices that POST a reading are
  auto-registered.

## Sensor specification & hard rules

| #   | Parameter               | Unit            | Accepted range (sensor)    | Hard-rule flags                                      |
| --- | ----------------------- | --------------- | -------------------------- | ---------------------------------------------------- |
| 1   | Soil reaction (pH)      | pH              | 3.0–9.0 (±0.1)             | Nutrient lockout below 5.0; liming advised below 5.5 |
| 2   | Electrical conductivity | dS/m            | 0.0–5.0                    | Salinity stress > 2.0 (Dry Zone command areas)       |
| 3   | Soil moisture (VWC)     | %               | 0–100                      | Dry < 20; saturated > 45; waterlogged > 60           |
| 4   | Soil temperature        | °C              | 10–50                      | Cold < 16; heat stress > 34                          |
| 5   | N / P / K               | mg/kg           | 0–1999 each                | Deficient / low / adequate / high bands per nutrient |
| 6   | GPS location            | decimal degrees | lat 5.9–9.9, lon 79.6–81.9 | Readings outside Sri Lanka bounds are rejected       |

Thresholds live in `src/lib/sensor-rules.ts` (shared by the UI, the ingest API
and the simulator) — tune them there.

## Device ingest API

The probe (ESP32/Arduino + RS485 NPK probe, FDR moisture, DS18B20, pH/EC
electrodes, NEO GPS) POSTs one JSON body per measurement cycle:

```bash
curl -X POST http://localhost:3030/api/readings \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "AGRI-001",
    "ph": 6.42,
    "ec": 1.24,
    "moisture": 28.5,
    "temperature": 27.3,
    "nitrogen": 65,
    "phosphorus": 18,
    "potassium": 120,
    "lat": 8.311,
    "lon": 80.402,
    "recordedAt": "2026-10-13T09:30:00+05:30"
  }'
```

- `201` — stored (auto-registers unknown devices; optional `deviceName`,
  `district`, `region`, `zone`, `crop` fields set the device metadata on first
  sight)
- `422` — rejected by the hard-rule filter, with a per-field issue list
- `recordedAt` is optional (ISO-8601, defaults to server time)

Other endpoints:

| Endpoint                               | Purpose                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /api/readings?deviceId=…&hours=…` | Readings for one device (oldest first); omit `deviceId` for latest across all |
| `GET /api/devices`                     | All devices with latest reading + reading count                               |
| `POST /api/devices`                    | Pre-register a probe with district / NRMC region / crop metadata              |

## Project structure

```
src/
├── db/
│   ├── schema.ts          # devices + readings tables (Drizzle)
│   ├── index.ts           # better-sqlite3 connection
│   └── seed.ts            # npm run db:seed
├── lib/
│   ├── sensor-rules.ts    # SRS spec, thresholds, zod ingest schema (shared)
│   ├── sensor-sim.ts      # deterministic per-device reading generator
│   ├── format.ts          # Asia/Colombo time formatters (hydration-safe)
│   └── server/
│       ├── queries.ts     # service layer: reads/writes, seed, simulate
│       └── server-fns.ts  # createServerFn RPC boundary for the dashboard
├── components/dashboard/  # sensor card, trend chart, Sri Lanka map, badges
└── routes/
    ├── index.tsx          # the dashboard
    └── api/               # /api/readings + /api/devices server routes
```

## Development

```bash
npm run dev        # dev server on :3030
npm run build      # production build (Nitro)
npm run lint       # eslint
npm run check      # prettier check
npm run db:studio  # browse the database
```

## Deploying to Vercel

1. Push the repo to GitHub/GitLab/Bitbucket
2. Import it in Vercel — the TanStack Start framework preset is detected
   (`vercel.json` makes it explicit)
3. Set `DATABASE_URL` under **Settings → Environment Variables** (use a
   persistent SQLite/Turso-style URL in production; `dev.db` is for local dev)
