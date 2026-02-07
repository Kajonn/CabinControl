import { config } from "./config.js";
import { createApp } from "./app.js";
import { logInfo } from "./logger.js";

const app = createApp();

app.listen(config.port, () => {
  logInfo(`Server listening on ${config.port}`);
});
