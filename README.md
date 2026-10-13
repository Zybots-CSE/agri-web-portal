# Agri Web Portal — Soil Sensor Dashboard

A full-stack dashboard for a smart soil-sensing probe (pH, EC, VWC moisture,
temperature, NPK + GPS), built for Sri Lankan farming systems. It ingests
readings from field probes over HTTP, applies the SRS **Step 1 hard-rule
filter**, and visualises live values, trends and sampling spots.

The system studies **one local area** — a single farm block — not the whole
country. Probes are **roving** handheld units: an operator places one at a
spot, takes a reading, then moves it somewhere else ("put → reading → move →
reading"). Nothing is permanently installed, so probes carry no coordinates
of their own — **every reading holds its own GPS fix** and (optionally) the
label of the sampling spot it was taken at.

Built with TanStack Start (React 19, SSR), TanStack Query, TanStack Router,
Drizzle ORM + SQLite, Tailwind CSS v4, shadcn-style components, and
[Leaflet](https://leafletjs.com) with
[OpenStreetMap](https://www.openstreetmap.org) raster tiles for the map.

## Quick start

```bash
npm install
npm run db:migrate  # apply the committed migrations (creates dev.db)
npm run db:seed     # seed the demo fleet: 3 roving probes, 7 days @ 30-min readings
npm run dev          # http://localhost:3030
```

The seed creates three roving probes walking eight plots of the demo farm
(Iluppallama Research Farm, Anuradhapura — DL1): paddy blocks, maize,
vegetables, chilli nursery, orchard, compost yard and a fallow plot. Soil
chemistry is modelled per plot with realistic bands — command-area salinity
in Paddy Block B, waterlogging in Paddy Block A, acidic soils in the Orchard
Block, nutrient deficits in the nursery/vegetable plots — so every
hard-rule flag is demonstrated somewhere on the farm. Adjust the farm,
plots and probe routes in `src/lib/sensor-sim.ts`.

## Dashboard

- **Live sensor cards** — pH, EC, moisture, temperature, N, P, K with the latest
  value, SRS target range, hard-rule status (OK / Watch / Alert), a colour-zoned
  range bar and a 24-h sparkline.
- **History trend charts** — 24 h / 3 d / 7 d per parameter, with watch/alert
  zone bands and hover tooltips showing the sampling spot and time
  (times in Asia/Colombo).
- **Sampling spot map** — a real OpenStreetMap (Leaflet) view of the farm
  block. Every placement appears as a small trail dot; a status-coloured
  ring marks the latest reading of each sampling spot (click for values).
  The selected probe's trail is emphasised.
- **Simulate reading** — walks the selected probe to its next placement on
  the deterministic route (great for demos without hardware).
- Auto-refreshes every 30 s; unknown probes that POST a reading are
  auto-registered.

## Sensor specification & hard rules

| #   | Parameter               | Unit            | Accepted range (sensor)    | Hard-rule flags                                                     |
| --- | ----------------------- | --------------- | -------------------------- | ------------------------------------------------------------------- |
| 1   | Soil reaction (pH)      | pH              | 3.0–9.0 (±0.1)             | Nutrient lockout below 5.0; liming advised below 5.5                |
| 2   | Electrical conductivity | dS/m            | 0.0–5.0                    | Salinity stress > 2.0 (Dry Zone command areas)                      |
| 3   | Soil moisture (VWC)     | %               | 0–100                      | Dry < 20; saturated > 45; waterlogged > 60                          |
| 4   | Soil temperature        | °C              | 10–50                      | Cold < 16; heat stress > 34                                         |
| 5   | N / P / K               | mg/kg           | 0–1999 each                | Deficient / low / adequate / high bands per nutrient                |
| 6   | GPS location            | decimal degrees | lat 5.9–9.9, lon 79.6–81.9 | Per-reading GPS fix; readings outside Sri Lanka bounds are rejected |

Thresholds live in `src/lib/sensor-rules.ts` (shared by the UI, the ingest API
and the simulator) — tune them there.

## Probe ingest API

The probe (ESP32/Arduino + RS485 NPK probe, FDR moisture, DS18B20, pH/EC
electrodes, NEO GPS) POSTs one JSON body **per placement**, tagged with the
GPS fix of the spot and an optional spot label:

```bash
curl -X POST http://localhost:3030/api/readings \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "PRB-001",
    "ph": 6.42,
    "ec": 1.24,
    "moisture": 28.5,
    "temperature": 27.3,
    "nitrogen": 65,
    "phosphorus": 18,
    "potassium": 120,
    "lat": 8.3525,
    "lon": 80.4631,
    "spot": "Paddy Block B",
    "recordedAt": "2026-10-13T09:30:00+05:30"
  }'
```

- `201` — stored (auto-registers unknown probes; optional `deviceName`,
  `district`, `region`, `zone`, `crop` fields set the probe metadata on first
  sight)
- `422` — rejected by the hard-rule filter, with a per-field issue list
- `spot` is optional (1–80 chars) — the sampling-spot label shown on the map
- `recordedAt` is optional (ISO-8601, defaults to server time)

Other endpoints:

| Endpoint                               | Purpose                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/readings?deviceId=…&hours=…` | Readings for one probe (oldest first); omit `deviceId` for latest across all                  |
| `GET /api/devices`                     | All probes with latest reading + reading count                                                |
| `POST /api/devices`                    | Pre-register a probe with district / NRMC region / crop metadata (no GPS — probes are mobile) |

## Project structure

```
drizzle/                # versioned SQL migrations (generated, committed to the repo)
src/
├── db/
│   ├── schema.ts          # devices (probes) + readings tables (Drizzle)
│   ├── index.ts           # better-sqlite3 connection
│   └── seed.ts            # npm run db:seed
├── lib/
│   ├── sensor-rules.ts    # SRS spec, thresholds, zod ingest schema (shared)
│   ├── sensor-sim.ts      # demo farm, plots, roving probe routes + generator
│   ├── format.ts          # Asia/Colombo time formatters (hydration-safe)
│   └── server/
│       ├── queries.ts     # service layer: reads/writes, seed, simulate walk
│       └── server-fns.ts  # createServerFn RPC boundary for the dashboard
├── components/dashboard/  # sensor card, trend chart, OSM spot map, badges
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

Schema changes are versioned: edit `src/db/schema.ts`, then
`npm run db:generate` (writes a timestamped SQL file under `drizzle/` — commit
it) and `npm run db:migrate` (applies pending migrations, tracked in the
`__drizzle_migrations` table). `db:push` is never used — schema always goes
through generated, reviewable migrations.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
rendered with Leaflet.

## Deploying to Vercel

1. Push the repo to GitHub/GitLab/Bitbucket
2. Import it in Vercel — the TanStack Start framework preset is detected
   (`vercel.json` makes it explicit)
3. Set `DATABASE_URL` under **Settings → Environment Variables** (use a
   persistent SQLite/Turso-style URL in production; `dev.db` is for local dev)
