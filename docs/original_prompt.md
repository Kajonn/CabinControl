# Original prompt

Build a production-ready Google Cloud solution that provides secure remote access and a custom web GUI for controlling Home Assistant-based electric radiator heating—without subscribing to a third-party remote access service.

High-level goal
- Home Assistant (HA) runs locally at home and remains the source of truth and automation “brains”.
- Google Cloud hosts a secure, Google-login-protected web app (browser + mobile-friendly) that remotely reads HA state and issues control commands.
- HA must NOT be exposed directly to the public internet (no port-forward of 8123).

Hard requirements (must satisfy)
1) Deployment in Google Cloud.
2) Authentication via Google login.
3) GUI works well in desktop browsers and on mobile (responsive; PWA nice-to-have).
4) GUI is specialized for heating:
   - 3 rooms: Living Room, Bedroom 1, Bedroom 2.
   - Show current room temperature, heating mode/status, and setpoint.
   - Allow setting setpoint per room and toggling heating on/off per room.
   - “Price limit” controls:
     - enable/disable price limiting
     - set max electricity price
     - set minimum temperature (freeze/comfort floor)
   - Provide an “Apply policy now” button that enforces:
     - If price > maxPrice AND roomTemp >= minTemp => disable heating (or reduce setpoint).
     - If roomTemp < minTemp => allow heating regardless of price.
5) HA must not be publicly reachable. Use a private network approach (VPN/tunnel) so Cloud Run reaches HA over a private IP.
6) Secrets must be stored safely (Secret Manager), never committed to git, never logged.

Assumptions / inputs (treat as configurable)
- HA provides a Long-Lived Access Token for REST API usage.
- HA entities exist (names may differ per user; make them configurable via env):
  Rooms:
    - climate.livingroom
    - climate.bedroom1
    - climate.bedroom2
  Electricity price sensor:
    - sensor.tibber_price (may be in kr/kWh or öre/kWh; handle either)
  Price-limit helpers in HA (recommended):
    - input_boolean.price_limit_enabled
    - input_number.max_price
    - input_number.min_temp
- HA is reachable from Google Cloud only through a VPN tunnel (WireGuard recommended).
- The custom web app should call HA REST endpoints:
  - GET /api/states/{entity_id}
  - POST /api/services/{domain}/{service}
  Using Authorization: Bearer <HA_TOKEN>

Recommended architecture (implement this)
A) Network / connectivity:
- Create a Google Cloud VPC and subnet.
- Run a small Compute Engine VM as a WireGuard gateway (server).
- Configure HA at home as a WireGuard client connecting to that VM.
- Cloud Run uses a Serverless VPC Access Connector to reach HA via the tunnel private IP.
- No public inbound access to HA; only outbound from HA to the WireGuard server.

B) Auth:
- Put Cloud Run behind Identity-Aware Proxy (IAP) for Google login.
- In backend, verify the IAP JWT header (x-goog-iap-jwt-assertion) as defense-in-depth.
- Restrict access to an allowlist of Google accounts (configurable). Also describe how to do this in IAM/IAP policy.

Tech stack (use these unless strongly justified otherwise)
- Backend: Node.js + TypeScript, Express (or Fastify).
- Frontend: React + Vite + Tailwind.
- Single Cloud Run service that serves both the static frontend and backend API (same origin).

Deliverables you must produce
1) Architecture + GCP setup guide
- Step-by-step instructions (gcloud commands + console notes) to:
  - Create project, enable APIs.
  - Create VPC/subnet.
  - Create WireGuard VM (smallest reasonable instance), firewall rules (minimal).
  - Install/configure WireGuard on VM (server) with example config.
  - Provide a WireGuard client config example suitable for HA (client).
  - Create Serverless VPC Access Connector.
  - Deploy Cloud Run with VPC connector and egress config so it can reach tunnel IPs.
  - Configure IAP for Cloud Run and limit to specific Google users/groups.
  - Create Secret Manager secrets and bind them to Cloud Run.
  - Explain operational basics: rotating HA token, updating allowlist.

2) Code repository (complete, runnable)
Provide a full repo tree with file contents.

Repo structure suggestion:
- /server (TypeScript)
  - IAP auth middleware:
    - Validate x-goog-iap-jwt-assertion signature using Google public keys.
    - Validate aud and iss claims as per IAP docs.
    - Extract user email and enforce allowlist.
  - HA client module:
    - getState(entityId)
    - callService(domain, service, data)
  - API endpoints (JSON):
    - GET /api/health
    - GET /api/rooms
      Return per room:
        - current_temperature (from climate state attrs and/or temp sensor)
        - setpoint
        - hvac_mode
        - hvac_action (if available)
      And global:
        - current_price (normalized to kr/kWh)
        - price_limit_enabled, max_price, min_temp
    - POST /api/rooms/:roomId/setpoint { temperature }
    - POST /api/rooms/:roomId/mode { mode: "heat" | "off" }
    - POST /api/settings/price-limit { enabled, maxPrice, minTemp }
      This should update the HA helpers if configured.
    - POST /api/actions/apply-policy
      Implements the policy described above by reading current state + price and then issuing HA commands.
  - Security:
    - Strict CORS (same origin only).
    - Basic rate limiting.
    - Never log secrets; sanitize logs.
    - Robust error handling with clear messages.

- /web (React)
  - Responsive UI:
    - 3 room cards (Living Room, Bedroom 1, Bedroom 2)
      Show: current temp, setpoint, mode/status
      Controls: +/- and slider for setpoint, toggle heat/off
    - Price panel:
      Show current price (kr/kWh)
      Toggle “Price limit enabled”
      Inputs for max price and min temp
      Button “Apply policy now”
    - Good mobile layout (stacked cards, large touch controls)
    - Loading/error states; “offline” indicator if API unreachable
    - PWA manifest is optional but appreciated

3) Deployment artifacts
- Dockerfile that builds frontend and backend and runs a single server on Cloud Run.
- Cloud Run deployment commands (gcloud run deploy …) including:
  - setting region
  - attaching VPC connector
  - mapping secrets to env vars
- Secret Manager commands (gcloud secrets create/versions add) and Cloud Run secret bindings.
- IAP enablement instructions for Cloud Run and IAM policy examples.

4) Test plan
- Local testing:
  - Provide a simple HA mock server (or fixtures) so the backend can be tested without a real HA.
  - Provide scripts for smoke tests: list rooms, set setpoint, toggle mode.
- GCP testing:
  - Confirm unauthenticated users cannot access the app (IAP blocks).
  - Confirm authenticated allowlisted users can.
  - Confirm Cloud Run can reach HA through the tunnel.
  - Confirm policy enforcement works.

5) Home Assistant automation example (optional but recommended)
- Provide an HA YAML automation that enforces the same policy locally using:
  - sensor.tibber_price
  - input_boolean.price_limit_enabled
  - input_number.max_price
  - input_number.min_temp
  - climate.* entities
So heating remains safe even if GCP is down.

Configuration details (must implement)
- Environment variables (or config file) for:
  - HA_BASE_URL (private tunnel IP + port, e.g., http://10.x.x.x:8123)
  - Secret name for HA_TOKEN (retrieved from Secret Manager)
  - Room mapping: roomId -> climate entity_id
  - Price sensor entity_id
  - Helper entity_ids (optional)
  - Allowed Google emails list (comma-separated) OR Google group domain match
- Normalize electricity price units:
  - If HA reports in öre/kWh, convert to kr/kWh (divide by 100).
  - If HA reports in kr/kWh, use as-is.

Cost minimization (describe, don’t guess exact amounts)
- Use Cloud Run autoscaling to 0.
- Use smallest reasonable VM for WireGuard gateway (e.g., e2-micro).
- Note possible network egress costs.

Output format
1) Short architecture plan (bullets).
2) Full repo tree + complete code files.
3) Deployment guide with commands.
4) Test guide.
5) HA automation YAML example.

Security notes
- Do not expose HA publicly.
- Use IAP + allowlist.
- Put HA token in Secret Manager.
- Apply least privilege in IAM.
- Document token rotation and how to revoke compromised credentials.
