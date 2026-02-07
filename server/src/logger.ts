const redactedKeys = ["authorization", "token", "secret", "password"];

export function sanitizeLog(data: unknown): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLog(item));
  }
  const entries = Object.entries(data as Record<string, unknown>).map(([key, value]) => {
    if (redactedKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      return [key, "[redacted]"];
    }
    return [key, sanitizeLog(value)];
  });
  return Object.fromEntries(entries);
}

export function logInfo(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.log(message, sanitizeLog(meta));
  } else {
    console.log(message);
  }
}

export function logError(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.error(message, sanitizeLog(meta));
  } else {
    console.error(message);
  }
}
