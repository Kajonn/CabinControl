# Requirements

## Functional requirements
1. Deploy the solution in Google Cloud. (Satisfied: GCP deployment guide, Cloud Run, VPC, WireGuard VM.)
2. Authenticate users via Google login. (Satisfied: IAP + allowlist + JWT validation.)
3. Provide a responsive web GUI for desktop/mobile. (Satisfied: React + Tailwind UI.)
4. Heating UI scope:
   - 3 rooms: Living Room, Bedroom 1, Bedroom 2.
   - Show current temperature, HVAC mode/status, and setpoint.
   - Allow setpoint changes and HVAC on/off toggle per room.
   - Price limit controls: enable/disable, max price, min temp.
   - Apply policy now with pricing/min-temp logic.
5. HA must not be publicly reachable; Cloud Run reaches HA over private VPN/tunnel IP only.
6. Secrets stored safely (Secret Manager), never committed or logged.

## Configurability requirements
1. HA base URL (private tunnel IP + port).
2. HA long-lived token via Secret Manager.
3. Room mapping roomId -> climate entity_id.
4. Price sensor entity_id with unit normalization (öre/kWh → kr/kWh).
5. Helper entity_ids for price-limit settings.
6. Allowed Google users via allowlist or domain.

## Non-functional requirements
1. Single Cloud Run service serving API + static web UI.
2. Defense-in-depth: IAP JWT verification in backend, strict same-origin behavior, rate limiting, and sanitized logs.
3. Cost minimization guidance (Cloud Run scale-to-zero, smallest WG VM).

## Artifacts
1. Architecture plan + deployment guide with commands.
2. Complete repo with server + web UI + Dockerfile.
3. Test guide and local mock HA.
4. Optional HA automation YAML for local enforcement.

## Test coverage assessment
- `server/scripts/e2e.ts` exercises:
  - GET /api/rooms
  - POST /api/rooms/:roomId/setpoint
  - POST /api/rooms/:roomId/mode
  - POST /api/actions/apply-policy
  - Uses mock HA to validate policy behavior in a controlled environment.
- Not currently covered by automated tests:
  - IAP JWT verification (auth flows) and allowlist enforcement.
  - Price-limit settings update endpoint (/api/settings/price-limit).
  - Price unit normalization edge cases (öre/kr).
  - UI rendering behavior and responsiveness (manual verification).
  - Deployment/IAP/VPC/WireGuard connectivity (manual validation).

