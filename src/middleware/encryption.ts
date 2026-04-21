import { NextFunction, Request, Response } from "express";
import crypto from "crypto";

import { decryptJson, encryptJson } from "../utils/encryption";

const TRANSPORT_KEY_BYTES = 32;
const legacySecret = process.env.ENCRYPTION_SECRET ?? "dev-encryption-secret-change-me";

type EncryptedBody = { payload?: string };
type TransportContext = { symmetricKey: string };

function getPrivateKey(): string {
  const value = process.env.BACKEND_PRIVATE_KEY ?? "";
  return value.replace(/\\n/g, "\n");
}

function decryptTransportKey(encryptedKeyBase64: string): string {
  const privateKey = getPrivateKey();
  if (!privateKey) {
    throw new Error("BACKEND_PRIVATE_KEY is missing");
  }
  const encryptedKey = Buffer.from(encryptedKeyBase64, "base64");
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptedKey,
  );
  if (decrypted.length !== TRANSPORT_KEY_BYTES) {
    throw new Error("Invalid transport key size");
  }
  return decrypted.toString("base64");
}

export function decryptEncryptedRequest(req: Request, res: Response, next: NextFunction) {
  const isEncrypted = req.header("x-encrypted") === "1";
  if (!isEncrypted) return next();

  try {
    const encryptedTransportKey = req.header("x-transport-key");
    const symmetricKey = encryptedTransportKey ? decryptTransportKey(encryptedTransportKey) : legacySecret;
    res.locals.transport = { symmetricKey } as TransportContext;

    const body = req.body as EncryptedBody | undefined;
    if (body?.payload) {
      req.body = decryptJson<Record<string, unknown>>(body.payload, symmetricKey);
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
    const transport = res.locals.transport as TransportContext | undefined;
    if (!transport?.symmetricKey) {
      res.status(500);
      return originalJson({ message: "Missing transport context" });
    }
    const wrapped = encryptJson(body, transport.symmetricKey);
    return originalJson(wrapped);
  }) as Response["json"];

  return next();
}
