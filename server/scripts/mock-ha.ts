import express from "express";

const app = express();
app.use(express.json());

const stateStore: Record<string, any> = {
  "climate.livingroom": {
    entity_id: "climate.livingroom",
    state: "heat",
    attributes: {
      current_temperature: 20.5,
      temperature: 21,
      hvac_mode: "heat",
      hvac_action: "heating",
    },
  },
  "climate.bedroom1": {
    entity_id: "climate.bedroom1",
    state: "off",
    attributes: {
      current_temperature: 18,
      temperature: 19,
      hvac_mode: "off",
      hvac_action: "idle",
    },
  },
  "climate.bedroom2": {
    entity_id: "climate.bedroom2",
    state: "heat",
    attributes: {
      current_temperature: 17.5,
      temperature: 20,
      hvac_mode: "heat",
      hvac_action: "heating",
    },
  },
  "sensor.tibber_price": {
    entity_id: "sensor.tibber_price",
    state: "1.45",
    attributes: {
      unit_of_measurement: "kr/kWh",
    },
  },
  "input_boolean.price_limit_enabled": {
    entity_id: "input_boolean.price_limit_enabled",
    state: "on",
    attributes: {},
  },
  "input_number.max_price": {
    entity_id: "input_number.max_price",
    state: "2.0",
    attributes: {},
  },
  "input_number.min_temp": {
    entity_id: "input_number.min_temp",
    state: "18",
    attributes: {},
  },
};

app.get("/api/states/:entityId", (req, res) => {
  const entity = stateStore[req.params.entityId];
  if (!entity) {
    res.status(404).send("Not found");
    return;
  }
  res.json(entity);
});

app.post("/api/services/:domain/:service", (req, res) => {
  const { domain, service } = req.params;
  const { entity_id, temperature, hvac_mode, value } = req.body;

  if (domain === "climate" && service === "set_temperature") {
    stateStore[entity_id].attributes.temperature = temperature;
  }
  if (domain === "climate" && service === "set_hvac_mode") {
    stateStore[entity_id].attributes.hvac_mode = hvac_mode;
    stateStore[entity_id].state = hvac_mode;
  }
  if (domain === "input_number" && service === "set_value") {
    stateStore[entity_id].state = String(value);
  }
  if (domain === "input_boolean" && service === "turn_on") {
    stateStore[entity_id].state = "on";
  }
  if (domain === "input_boolean" && service === "turn_off") {
    stateStore[entity_id].state = "off";
  }

  res.json([{ success: true }]);
});

const port = Number(process.env.MOCK_HA_PORT ?? 8123);
app.listen(port, () => {
  console.log(`Mock HA listening on ${port}`);
});
