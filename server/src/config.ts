import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const roomSchema = z.record(
  z.string(),
  z.object({
    name: z.string(),
    entity: z.string(),
  })
);

const helpersSchema = z
  .object({
    priceLimitEnabled: z.string().optional(),
    maxPrice: z.string().optional(),
    minTemp: z.string().optional(),
  })
  .optional();

const configSchema = z.object({
  port: z.coerce.number().default(8080),
  haBaseUrl: z.string().url(),
  haToken: z.string().min(1),
  priceSensor: z.string().min(1),
  roomMappings: roomSchema,
  priceHelpers: helpersSchema,
  allowedEmails: z.array(z.string().email()).default([]),
  allowedDomain: z.string().optional(),
  iapAudience: z.string().optional(),
  iapEnforce: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        return value.toLowerCase() === "true";
      }
      if (typeof value === "boolean") {
        return value;
      }
      return true;
    },
    z.boolean()
  ),
  publicBaseUrl: z.string().url(),
  logLevel: z.string().default("info"),
});

const roomMappingsEnv = process.env.ROOM_MAPPINGS;
const priceHelpersEnv = process.env.PRICE_HELPERS;
const allowedEmailsEnv = process.env.ALLOWED_EMAILS;

const parsedRoomMappings = roomMappingsEnv ? JSON.parse(roomMappingsEnv) : undefined;
const parsedPriceHelpers = priceHelpersEnv ? JSON.parse(priceHelpersEnv) : undefined;
const parsedAllowedEmails = allowedEmailsEnv
  ? allowedEmailsEnv
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean)
  : [];

const rawConfig = configSchema.parse({
  port: process.env.PORT ?? 8080,
  haBaseUrl: process.env.HA_BASE_URL,
  haToken: process.env.HA_TOKEN,
  priceSensor: process.env.PRICE_SENSOR_ENTITY_ID,
  roomMappings: parsedRoomMappings ?? {
    livingroom: { name: "Living Room", entity: "climate.livingroom" },
    bedroom1: { name: "Bedroom 1", entity: "climate.bedroom1" },
    bedroom2: { name: "Bedroom 2", entity: "climate.bedroom2" },
  },
  priceHelpers: parsedPriceHelpers,
  allowedEmails: parsedAllowedEmails,
  allowedDomain: process.env.ALLOWED_DOMAIN,
  iapAudience: process.env.IAP_AUDIENCE,
  iapEnforce: process.env.IAP_ENFORCE ?? true,
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:5173",
  logLevel: process.env.LOG_LEVEL ?? "info",
});

if (rawConfig.iapEnforce && !rawConfig.iapAudience) {
  throw new Error("IAP_AUDIENCE must be set when IAP_ENFORCE is true");
}

export const config = {
  ...rawConfig,
  iapAudience: rawConfig.iapAudience ?? "",
};

export type RoomConfig = typeof config.roomMappings;
