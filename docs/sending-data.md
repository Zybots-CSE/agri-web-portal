# Sending data to the ingest API

A practical guide for whoever writes the probe firmware (ESP32/Arduino) or
wants to test the pipeline by hand. The dashboard lives at
`http://localhost:3030` in dev — from the probe, use the LAN IP of the
machine running the portal (e.g. `http://192.168.1.20:3030`).

## The model: one POST per placement

Probes are **roving** units — put at a spot → take a reading → move on. So:

- The probe itself **carries no coordinates**. Every reading POSTs its **own
  GPS fix** of the spot it currently sits at.
- One HTTP POST = **one reading**. There is no bulk/array endpoint.
- Unknown `deviceId`s are **auto-registered** on first sight — registration
  is optional.
- Every value must lie inside its **SRS sensor range**. Anything outside is
  rejected with `422` — this is the **Step 1 hard-rule filter**. The portal
  never stores readings it would later have to discard.

## Quick test with curl

```bash
curl -X POST http://localhost:3030/api/readings \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "PRB-004",
    "ph": 6.42,
    "ec": 1.24,
    "moisture": 28.5,
    "temperature": 27.3,
    "nitrogen": 65,
    "phosphorus": 18,
    "potassium": 120,
    "lat": 8.3525,
    "lon": 80.4631,
    "spot": "Paddy Block B"
  }'
```

- `201` — stored. Body contains the stored reading (see below).
- `400` — body is not valid JSON (check `Content-Type: application/json`).
- `422` — rejected by the hard-rule filter, with a per-field issue list.

## Request reference — `POST /api/readings`

Header: `Content-Type: application/json`. All sensor values are **JSON
numbers** (send `6.4`, not `"6.4"`). Bounds are inclusive.

| Field                                   | Required | Accepted range / format                  | Notes                                                               |
| --------------------------------------- | -------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `deviceId`                              | yes      | 2–40 chars: letters, digits, `.` `_` `-` | must start with a letter or digit; auto-registers if unknown        |
| `ph`                                    | yes      | 3.0 – 9.0                                | pH scale                                                            |
| `ec`                                    | yes      | 0.0 – 5.0 dS/m                           |                                                                     |
| `moisture`                              | yes      | 0 – 100 % VWC                            |                                                                     |
| `temperature`                           | yes      | 10 – 50 °C                               |                                                                     |
| `nitrogen` / `phosphorus` / `potassium` | yes      | 0 – 1999 mg/kg                           |                                                                     |
| `lat`                                   | yes      | 5.9 – 9.9                                | GPS fix **of this placement** (Sri Lanka bounds)                    |
| `lon`                                   | yes      | 79.6 – 81.9                              |                                                                     |
| `spot`                                  | no       | 1–80 chars                               | sampling-spot label shown on the map/trends, e.g. `"Paddy Block B"` |
| `recordedAt`                            | no       | ISO-8601 **with** `Z` or `+05:30`        | defaults to server time; omit it when the probe posts live readings |
| `deviceName`                            | no       | 1–80 chars                               | friendly name, used only when auto-registering                      |
| `district` / `region` / `zone` / `crop` | no       | strings                                  | probe metadata, used only when auto-registering                     |

Firmware tips:

- **No GPS fix yet? Don't POST.** `lat`/`lon` are required — a zero or stale
  fix outside the bounds is rejected with `422`.
- **Don't retry a `422` with the same values** — it will fail again. The
  sensor is reporting outside its SRS range; log it, skip the reading and
  check the hardware.
- If you buffer readings while offline, include `recordedAt` with the real
  capture time and a timezone designator —
  `"2026-10-13T09:30:00+05:30"` or `"2026-10-13T04:00:00Z"` are both valid;
  a bare local time like `"2026-10-13T09:30:00"` is not.

### `201` response

```json
{
  "reading": {
    "id": 1013,
    "deviceId": "PRB-004",
    "recordedAt": "2026-10-13T04:00:00.000Z",
    "ph": 6.42,
    "ec": 1.24,
    "moisture": 28.5,
    "temperature": 27.3,
    "nitrogen": 65,
    "phosphorus": 18,
    "potassium": 120,
    "lat": 8.3525,
    "lon": 80.4631,
    "spot": "Paddy Block B"
  },
  "deviceCreated": true
}
```

`deviceCreated: true` means the portal had never seen this `deviceId` and
just registered it. `recordedAt` always comes back as UTC ISO-8601.

### `422` response — hard-rule rejection

Sending `ph: 2.0` and `lat: 15.0` (both outside their ranges):

```json
{
  "error": "Validation failed — reading rejected by hard rule filter",
  "issues": [
    { "path": "ph", "message": "Too small: expected number to be >=3" },
    { "path": "lat", "message": "Latitude must be within 5.9–9.9 (Sri Lanka)" }
  ]
}
```

Every offending field gets its own entry in `issues` — fix or skip, then
continue with the next placement.

### `400` response

```json
{ "error": "Invalid JSON body" }
```

Almost always a missing `Content-Type: application/json` header or a
malformed body.

## Registering a probe in advance (optional)

`POST /api/readings` auto-registers unknown probes, but pre-registering lets
you attach the metadata the dashboard shows (device selector, chips). This
is an **upsert** — posting again updates the metadata.

```bash
curl -X POST http://localhost:3030/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "id": "PRB-004",
    "name": "Lowland Probe 4",
    "district": "Anuradhapura",
    "region": "DL1",
    "zone": "Lowland",
    "crop": "Paddy"
  }'
```

`201` returns the device object (with `readingCount` and `latestReading`).
Note there are **no coordinates here** — probes are mobile, GPS travels with
each reading.

## ESP32 example sketch

A minimal but complete flow using the built-in `HTTPClient`. Replace the
sensor reads with your real drivers (RS485 NPK probe, FDR moisture, DS18B20,
pH/EC electrodes, NEO GPS).

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char *WIFI_SSID  = "YourWiFiName";
const char *WIFI_PASS  = "YourWiFiPassword";

// LAN address of the machine running the portal
const char *INGEST_URL = "http://192.168.1.20:3030/api/readings";
const char *DEVICE_ID  = "PRB-004";

bool sendReading(float ph, float ec, float moisture, float temperature,
                 float n, float p, float k,
                 double lat, double lon, const char *spot) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi down, skipping upload");
    return false;
  }

  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");

  char body[512];
  snprintf(body, sizeof(body),
           "{"
           "\"deviceId\":\"%s\","
           "\"ph\":%.2f,"
           "\"ec\":%.2f,"
           "\"moisture\":%.1f,"
           "\"temperature\":%.1f,"
           "\"nitrogen\":%.0f,"
           "\"phosphorus\":%.0f,"
           "\"potassium\":%.0f,"
           "\"lat\":%.6f,"
           "\"lon\":%.6f,"
           "\"spot\":\"%s\""
           "}",
           DEVICE_ID, ph, ec, moisture, temperature, n, p, k, lat, lon,
           spot);

  int code = http.POST(body);

  if (code == 201) {
    Serial.println("Reading accepted");
  } else if (code == 422) {
    // Hard-rule filter rejected the values (sensor out of its SRS range).
    // Retrying the same numbers will fail again — check the hardware.
    Serial.printf("Rejected by hard-rule filter: %s\n",
                  http.getString().c_str());
  } else {
    Serial.printf("Upload failed: %d %s\n", code, http.getString().c_str());
  }
  http.end();
  return code == 201;
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void loop() {
  // Read your sensors + wait for a GPS fix, then send ONE reading
  // per placement:
  sendReading(
      6.42,            // pH          3.0 – 9.0
      1.24,            // EC dS/m     0.0 – 5.0
      28.5,            // moisture %  0 – 100
      27.3,            // temp °C     10 – 50
      65,              // N mg/kg     0 – 1999
      18,              // P mg/kg     0 – 1999
      120,             // K mg/kg     0 – 1999
      8.3525,          // lat         5.9 – 9.9
      80.4631,         // lon         79.6 – 81.9
      "Paddy Block B"  // spot label  optional
  );

  delay(60_000); // demo cadence — a real probe sends once per placement
}
```

Notes for the sketch:

- `%f` in `snprintf` works on the ESP32 core (it would not on AVR).
- If you prefer `ArduinoJson`, build the same object with `JsonDocument` —
  the wire format is identical.
- The portal sets no CORS headers, which is fine for device-to-server calls.
  Calling the ingest API from a web page on another origin will be blocked
  by the browser, not by the portal.
- No API key / auth is required — the portal is designed for a trusted local
  network or dev machine.

## Reading data back

| Endpoint                               | Returns                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/readings?deviceId=…&hours=…` | `{ "count": n, "readings": […] }` oldest-first; `hours` 1–720, default 168; omit `deviceId` to get readings across all probes |
| `GET /api/devices`                     | `{ "devices": […] }` with `readingCount` and `latestReading`                                                                  |

Readings come back in the same shape as the `reading` object in the `201`
response above.
