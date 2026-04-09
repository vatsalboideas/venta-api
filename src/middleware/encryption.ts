import { NextFunction, Request, Response } from "express";

import { decryptJson, encryptJson } from "../utils/encryption";

const secret = process.env.ENCRYPTION_SECRET ?? "dev-encryption-secret-change-me";

type EncryptedBody = { payload: string };

export function decryptEncryptedRequest(req: Request, res: Response, next: NextFunction) {
  const isEncrypted = req.header("x-encrypted") === "1";
  if (!isEncrypted) return next();

  try {
    const body = req.body as EncryptedBody | undefined;
    if (body?.payload) {
      req.body = decryptJson<Record<string, unknown>>(body.payload, secret);
    }
    return next();
  } catch {
    return res.status(400).json({ message: "Invalid encrypted payload" });
  }
}

export function encryptEncryptedResponse(req: Request, res: Response, next: NextFunction) {
  const isEncrypted = req.header("x-encrypted") === "1";
  if (!isEncrypted) return next();

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    const wrapped = encryptJson(body, secret);
    return originalJson(wrapped);
  }) as Response["json"];

  return next();
}
