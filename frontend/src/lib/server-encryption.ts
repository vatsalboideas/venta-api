import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptServerPayload(value: unknown, secret: string): { payload: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(secret), iv);
  const raw = JSON.stringify(value);
  const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { payload: Buffer.concat([iv, tag, encrypted]).toString("base64") };
}

export function decryptServerPayload<T>(payload: string, secret: string): T {
  const merged = Buffer.from(payload, "base64");
  const iv = merged.subarray(0, IV_LENGTH);
  const tag = merged.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = merged.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, getKey(secret), iv);
  decipher.setAuthTag(tag);
  const raw = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(raw) as T;
}
