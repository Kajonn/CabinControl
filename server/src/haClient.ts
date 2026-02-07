import fetch from "node-fetch";
import { config } from "./config.js";
import { logError } from "./logger.js";

type HaState = {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
};

function buildHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.haToken}`,
    "Content-Type": "application/json",
  };
}

export async function getState(entityId: string): Promise<HaState> {
  const response = await fetch(`${config.haBaseUrl}/api/states/${entityId}`, {
    method: "GET",
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const message = await response.text();
    logError("HA getState failed", { entityId, status: response.status });
    throw new Error(`HA state fetch failed: ${message}`);
  }

  return (await response.json()) as HaState;
}

export async function callService(
  domain: string,
  service: string,
  data: Record<string, unknown>
): Promise<void> {
  const response = await fetch(`${config.haBaseUrl}/api/services/${domain}/${service}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const message = await response.text();
    logError("HA callService failed", { domain, service, status: response.status });
    throw new Error(`HA service call failed: ${message}`);
  }
}

export type { HaState };
