import { Router } from "express";
import { z } from "zod";
import { config } from "./config.js";
import { callService, getState } from "./haClient.js";
import { applyPricePolicy, normalizePrice } from "./policy.js";

const router = Router();

const setpointSchema = z.object({ temperature: z.number().min(5).max(30) });
const modeSchema = z.object({ mode: z.enum(["heat", "off"]) });
const priceLimitSchema = z.object({
  enabled: z.boolean(),
  maxPrice: z.number().min(0),
  minTemp: z.number().min(0),
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/rooms", async (_req, res, next) => {
  try {
    const rooms = await Promise.all(
      Object.entries(config.roomMappings).map(async ([roomId, room]) => {
        const state = await getState(room.entity);
        const attributes = state.attributes as Record<string, unknown>;
        return {
          id: roomId,
          name: room.name,
          entity_id: room.entity,
          current_temperature: Number(attributes.current_temperature ?? state.state),
          setpoint: Number(attributes.temperature ?? state.state),
          hvac_mode: String(attributes.hvac_mode ?? state.state),
          hvac_action: attributes.hvac_action ?? null,
        };
      })
    );

    const priceState = await getState(config.priceSensor);
    const currentPrice = normalizePrice(priceState);

    let priceLimitEnabled = null;
    let maxPrice = null;
    let minTemp = null;

    if (
      config.priceHelpers?.priceLimitEnabled &&
      config.priceHelpers.maxPrice &&
      config.priceHelpers.minTemp
    ) {
      const [limitState, maxState, minState] = await Promise.all([
        getState(config.priceHelpers.priceLimitEnabled),
        getState(config.priceHelpers.maxPrice),
        getState(config.priceHelpers.minTemp),
      ]);

      priceLimitEnabled = limitState.state === "on";
      maxPrice = Number(maxState.state);
      minTemp = Number(minState.state);
    }

    res.json({
      rooms,
      price: {
        current_price: currentPrice,
        unit: "kr/kWh",
      },
      price_limit: {
        enabled: priceLimitEnabled,
        max_price: maxPrice,
        min_temp: minTemp,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/rooms/:roomId/setpoint", async (req, res, next) => {
  try {
    const room = config.roomMappings[req.params.roomId];
    if (!room) {
      res.status(404).json({ error: "Unknown room" });
      return;
    }

    const payload = setpointSchema.parse(req.body);
    await callService("climate", "set_temperature", {
      entity_id: room.entity,
      temperature: payload.temperature,
    });

    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

router.post("/rooms/:roomId/mode", async (req, res, next) => {
  try {
    const room = config.roomMappings[req.params.roomId];
    if (!room) {
      res.status(404).json({ error: "Unknown room" });
      return;
    }

    const payload = modeSchema.parse(req.body);
    await callService("climate", "set_hvac_mode", {
      entity_id: room.entity,
      hvac_mode: payload.mode,
    });

    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

router.post("/settings/price-limit", async (req, res, next) => {
  try {
    if (
      !config.priceHelpers?.priceLimitEnabled ||
      !config.priceHelpers.maxPrice ||
      !config.priceHelpers.minTemp
    ) {
      res.status(400).json({ error: "Price limit helpers not configured" });
      return;
    }

    const payload = priceLimitSchema.parse(req.body);

    await Promise.all([
      callService("input_boolean", payload.enabled ? "turn_on" : "turn_off", {
        entity_id: config.priceHelpers.priceLimitEnabled,
      }),
      callService("input_number", "set_value", {
        entity_id: config.priceHelpers.maxPrice,
        value: payload.maxPrice,
      }),
      callService("input_number", "set_value", {
        entity_id: config.priceHelpers.minTemp,
        value: payload.minTemp,
      }),
    ]);

    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

router.post("/actions/apply-policy", async (_req, res, next) => {
  try {
    const results = await applyPricePolicy();
    res.json({ status: "ok", results });
  } catch (error) {
    next(error);
  }
});

export { router };
