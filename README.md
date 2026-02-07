# CabinControl

Secure, Google Cloud-hosted remote control for Home Assistant-based electric radiator heating.

## Repository structure

```
.
├── Dockerfile
├── README.md
├── docs
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── TESTING.md
│   └── ha_automation.yaml
├── server
│   ├── package.json
│   ├── scripts
│   │   ├── e2e.ts
│   │   └── mock-ha.ts
│   ├── src
│   │   ├── app.ts
│   │   ├── config.ts
│   │   ├── haClient.ts
│   │   ├── iap.ts
│   │   ├── index.ts
│   │   ├── logger.ts
│   │   ├── policy.ts
│   │   └── routes.ts
│   └── tsconfig.json
└── web
    ├── index.html
    ├── package.json
    ├── postcss.config.js
    ├── public
    │   └── manifest.json
    ├── src
    │   ├── App.tsx
    │   ├── index.css
    │   └── main.tsx
    ├── tailwind.config.js
    ├── tsconfig.json
    └── vite.config.ts
```

## Configuration

The server is configured via environment variables:

- `HA_BASE_URL`: Private HA URL via WireGuard (ex: `http://10.20.0.2:8123`).
- `HA_TOKEN`: Long-lived HA token (inject via Secret Manager).
- `PRICE_SENSOR_ENTITY_ID`: Price sensor entity (ex: `sensor.tibber_price`).
- `ROOM_MAPPINGS`: JSON mapping of room IDs to climate entities.
- `PRICE_HELPERS`: JSON mapping of helper entities (optional).
- `ALLOWED_EMAILS`: Comma-separated allowlist of Google accounts.
- `ALLOWED_DOMAIN`: Optional allowlist domain suffix.
- `IAP_AUDIENCE`: IAP audience string `/projects/PROJECT_NUMBER/apps/PROJECT_ID` (required when `IAP_ENFORCE=true`).
- `IAP_ENFORCE`: `true` or `false` (use `false` for local dev).
- `PUBLIC_BASE_URL`: Origin allowed by the API for same-origin CORS enforcement.

See `docs/DEPLOYMENT.md` for gcloud deployment steps and IAP configuration.
