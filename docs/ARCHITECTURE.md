# Architecture plan

- Home Assistant (HA) remains local and private, reachable only through a WireGuard tunnel to Google Cloud.
- A Google Cloud VPC hosts a small Compute Engine VM that terminates the WireGuard server.
- Cloud Run hosts a single Node.js + React service; it reaches HA through a Serverless VPC Access connector into the VPC.
- Identity-Aware Proxy (IAP) protects Cloud Run with Google login; the backend validates the IAP JWT and enforces an allowlist.
- Secrets (HA token, allowlist config) are stored in Secret Manager and injected as env vars.
- The web GUI is responsive for desktop and mobile and provides room controls plus price-limit policy controls.
