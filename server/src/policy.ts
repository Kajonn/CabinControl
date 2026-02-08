import { config } from "./config.js";
import { callService, getState, HaState } from "./haClient.js";

export type RoomPolicyResult = {
  roomId: string;
  action: "heat" | "off" | "none";
  reason: string;
};

function normalizePrice(state: HaState): number {
  const value = Number(state.state);
  const unit = String(state.attributes.unit_of_measurement ?? "").toLowerCase();
  if (Number.isNaN(value)) {
    throw new Error("Invalid price value");
  }
  if (unit.includes("öre") || unit.includes("øre") || unit.includes("ore")) {
    return value / 100;
  }
  return value;
}

export async function applyPricePolicy(): Promise<RoomPolicyResult[]> {
  const priceState = await getState(config.priceSensor);
  const currentPrice = normalizePrice(priceState);

  const helpers = config.priceHelpers;
  if (!helpers?.priceLimitEnabled || !helpers.maxPrice || !helpers.minTemp) {
    throw new Error("Price limit helpers not configured");
  }

  const [limitEnabledState, maxPriceState, minTempState] = await Promise.all([
    getState(helpers.priceLimitEnabled),
    getState(helpers.maxPrice),
    getState(helpers.minTemp),
  ]);

  const limitEnabled = limitEnabledState.state === "on";
  const maxPrice = Number(maxPriceState.state);
  const minTemp = Number(minTempState.state);

  const results: RoomPolicyResult[] = [];

  await Promise.all(
    Object.entries(config.roomMappings).map(async ([roomId, room]) => {
      const climate = await getState(room.entity);
      const currentTemp = Number(climate.attributes.current_temperature ?? climate.state);

      if (!limitEnabled) {
        results.push({ roomId, action: "none", reason: "limit_disabled" });
        return;
      }

      if (currentTemp < minTemp) {
        await callService("climate", "set_hvac_mode", {
          entity_id: room.entity,
          hvac_mode: "heat",
        });
        results.push({ roomId, action: "heat", reason: "below_min_temp" });
        return;
      }

      if (currentPrice > maxPrice) {
        await callService("climate", "set_hvac_mode", {
          entity_id: room.entity,
          hvac_mode: "off",
        });
        results.push({ roomId, action: "off", reason: "price_above_limit" });
        return;
      }

      await callService("climate", "set_hvac_mode", {
        entity_id: room.entity,
        hvac_mode: "heat",
      });
      results.push({ roomId, action: "heat", reason: "price_ok" });
    })
  );

  return results;
}

export { normalizePrice };
