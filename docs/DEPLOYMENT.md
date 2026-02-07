# Deployment guide (Google Cloud)

## 1) Project + APIs

```bash
gcloud projects create cabincontrol-prod --set-as-default

gcloud config set project cabincontrol-prod

gcloud config set run/region europe-north1

gcloud services enable \
  run.googleapis.com \
  compute.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  iap.googleapis.com
```

## 2) VPC + subnet

```bash
gcloud compute networks create cabincontrol-vpc --subnet-mode=custom

gcloud compute networks subnets create cabincontrol-subnet \
  --network=cabincontrol-vpc \
  --region=europe-north1 \
  --range=10.10.0.0/24
```

## 3) WireGuard VM (server)

Create a small VM (e2-micro) with no public inbound firewall rules beyond SSH if needed:

```bash
gcloud compute instances create cabincontrol-wg \
  --zone=europe-north1-b \
  --machine-type=e2-micro \
  --network=cabincontrol-vpc \
  --subnet=cabincontrol-subnet \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --tags=wireguard
```

Allow UDP 51820 from HA’s public IP only (replace `HA_PUBLIC_IP`):

```bash
gcloud compute firewall-rules create allow-wireguard \
  --network=cabincontrol-vpc \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=udp:51820 \
  --source-ranges=HA_PUBLIC_IP/32 \
  --target-tags=wireguard
```

Install WireGuard on the VM:

```bash
sudo apt-get update && sudo apt-get install -y wireguard
sudo umask 077
wg genkey | tee /etc/wireguard/server.key | wg pubkey > /etc/wireguard/server.pub
wg genkey | tee /etc/wireguard/ha.key | wg pubkey > /etc/wireguard/ha.pub
```

Example `/etc/wireguard/wg0.conf` (server):

```
[Interface]
Address = 10.20.0.1/24
ListenPort = 51820
PrivateKey = <contents of /etc/wireguard/server.key>

[Peer]
PublicKey = <contents of /etc/wireguard/ha.pub>
AllowedIPs = 10.20.0.2/32
PersistentKeepalive = 25
```

Enable and start WireGuard:

```bash
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

## 4) WireGuard client (Home Assistant)

Install WireGuard add-on or use a host OS package and configure:

```
[Interface]
PrivateKey = <ha.key>
Address = 10.20.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = <server.pub>
Endpoint = <WG_SERVER_EXTERNAL_IP>:51820
AllowedIPs = 10.20.0.0/24
PersistentKeepalive = 25
```

Ensure HA is reachable on `http://10.20.0.2:8123` from the VPC.

## 5) Serverless VPC Access connector

```bash
gcloud compute networks vpc-access connectors create cabincontrol-connector \
  --network=cabincontrol-vpc \
  --region=europe-north1 \
  --range=10.8.0.0/28
```

## 6) Secret Manager

```bash
echo -n "<HA_LONG_LIVED_TOKEN>" | gcloud secrets create ha-token --data-file=-

echo -n "user1@example.com,user2@example.com" | gcloud secrets create allowed-emails --data-file=-
```

## 7) Cloud Run deploy

Build and deploy from the repo root:

```bash
gcloud run deploy cabincontrol \
  --source . \
  --region europe-north1 \
  --allow-unauthenticated=false \
  --vpc-connector=cabincontrol-connector \
  --vpc-egress=private-ranges-only \
  --set-env-vars "HA_BASE_URL=http://10.20.0.2:8123,PRICE_SENSOR_ENTITY_ID=sensor.tibber_price,PUBLIC_BASE_URL=https://YOUR_RUN_URL,IAP_AUDIENCE=/projects/PROJECT_NUMBER/apps/PROJECT_ID,ROOM_MAPPINGS={\"livingroom\":{\"name\":\"Living Room\",\"entity\":\"climate.livingroom\"},\"bedroom1\":{\"name\":\"Bedroom 1\",\"entity\":\"climate.bedroom1\"},\"bedroom2\":{\"name\":\"Bedroom 2\",\"entity\":\"climate.bedroom2\"}},PRICE_HELPERS={\"priceLimitEnabled\":\"input_boolean.price_limit_enabled\",\"maxPrice\":\"input_number.max_price\",\"minTemp\":\"input_number.min_temp\"}" \
  --set-secrets "HA_TOKEN=ha-token:latest,ALLOWED_EMAILS=allowed-emails:latest"
```

## 8) Enable IAP + restrict access

1. Open **Security → Identity-Aware Proxy** in the console.
2. Find the Cloud Run service and enable IAP.
3. Grant `IAP-secured Web App User` to a Google Group or user allowlist.

You can also set IAM via CLI:

```bash
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=cabincontrol \
  --member="user:user1@example.com" \
  --role="roles/iap.httpsResourceAccessor"
```

## 9) Operations & rotation

- Rotate HA tokens by creating a new token in HA, updating `ha-token` secret, and redeploying Cloud Run.
- Update allowlists by editing the `allowed-emails` secret or IAP IAM bindings.
- Use least-privilege IAM for deployment and secret access.

## Cost minimization

- Cloud Run scales to zero when idle.
- Use the smallest WireGuard VM (e2-micro) and keep firewall rules minimal.
- Watch for egress costs when polling HA from Cloud Run.
