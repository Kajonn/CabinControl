import { createRemoteJWKSet, jwtVerify } from "jose";
import { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

const JWKS_URL = new URL("https://www.gstatic.com/iap/verify/public_key-jwk");
const jwks = createRemoteJWKSet(JWKS_URL);

function isEmailAllowed(email: string): boolean {
  const { allowedEmails, allowedDomain } = config;
  if (allowedEmails.length > 0 && allowedEmails.includes(email)) {
    return true;
  }
  if (allowedDomain && email.endsWith(`@${allowedDomain}`)) {
    return true;
  }
  return false;
}

export async function iapAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!config.iapEnforce) {
    next();
    return;
  }

  const assertion = req.header("x-goog-iap-jwt-assertion");
  if (!assertion) {
    res.status(401).json({ error: "Missing IAP assertion" });
    return;
  }

  try {
    const { payload } = await jwtVerify(assertion, jwks, {
      issuer: "https://cloud.google.com/iap",
      audience: config.iapAudience,
    });

    const email = payload.email as string | undefined;
    if (!email) {
      res.status(403).json({ error: "Missing email in IAP token" });
      return;
    }

    if (!isEmailAllowed(email)) {
      res.status(403).json({ error: "User not allowed" });
      return;
    }

    res.locals.user = { email };
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid IAP assertion" });
  }
}
