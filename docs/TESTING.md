# Test guide

## Local testing

1. Install dependencies:

```bash
cd server && npm install
cd ../web && npm install
```

2. Run the mock HA server:

```bash
cd server
npm run mock-ha
```

3. Run the API server in another terminal:

```bash
cd server
HA_BASE_URL=http://127.0.0.1:8123 \
HA_TOKEN=local-test \
PRICE_SENSOR_ENTITY_ID=sensor.tibber_price \
IAP_ENFORCE=false \
PUBLIC_BASE_URL=http://localhost:5173 \
npm run dev
```

4. Run the web UI:

```bash
cd web
npm run dev
```

5. E2E smoke test (starts mock + server and calls APIs):

```bash
cd server
npm run test:e2e
```

## GCP testing

- Verify unauthenticated access is blocked (IAP login prompt).
- Verify an allowlisted user can load the UI and see room data.
- Confirm Cloud Run can reach HA via the WireGuard tunnel (toggle a room and see HA update).
- Use the "Apply policy now" action and confirm HVAC modes change as expected.
