import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const env = {
  ...process.env,
  PORT: "8085",
  HA_BASE_URL: "http://127.0.0.1:8123",
  HA_TOKEN: "test-token",
  PRICE_SENSOR_ENTITY_ID: "sensor.tibber_price",
  ROOM_MAPPINGS: JSON.stringify({
    livingroom: { name: "Living Room", entity: "climate.livingroom" },
    bedroom1: { name: "Bedroom 1", entity: "climate.bedroom1" },
    bedroom2: { name: "Bedroom 2", entity: "climate.bedroom2" },
  }),
  PRICE_HELPERS: JSON.stringify({
    priceLimitEnabled: "input_boolean.price_limit_enabled",
    maxPrice: "input_number.max_price",
    minTemp: "input_number.min_temp",
  }),
  IAP_ENFORCE: "false",
  PUBLIC_BASE_URL: "http://localhost:8085",
};

function spawnProcess(command: string, args: string[]) {
  return spawn(command, args, { env, stdio: "inherit" });
}

async function waitForServer(url: string) {
  for (let i = 0; i < 20; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      // ignore
    }
    await delay(250);
  }
  throw new Error("Server did not start");
}

async function run() {
  const mock = spawnProcess("node", ["--loader", "tsx", "scripts/mock-ha.ts"]);
  const server = spawnProcess("node", ["--loader", "tsx", "src/index.ts"]);

  try {
    await waitForServer("http://localhost:8085/api/health");

    const roomsResponse = await fetch("http://localhost:8085/api/rooms");
    if (!roomsResponse.ok) {
      throw new Error("Failed to load rooms");
    }

    const setpointResponse = await fetch("http://localhost:8085/api/rooms/livingroom/setpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temperature: 22 }),
    });
    if (!setpointResponse.ok) {
      throw new Error("Failed to set setpoint");
    }

    const modeResponse = await fetch("http://localhost:8085/api/rooms/bedroom1/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "heat" }),
    });
    if (!modeResponse.ok) {
      throw new Error("Failed to set mode");
    }

    const policyResponse = await fetch("http://localhost:8085/api/actions/apply-policy", {
      method: "POST",
    });
    if (!policyResponse.ok) {
      throw new Error("Failed to apply policy");
    }

    console.log("E2E tests passed");
  } finally {
    mock.kill();
    server.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
