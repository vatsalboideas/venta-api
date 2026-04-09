const encoder = new TextEncoder();
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

async function getKey(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
  if (typeof window === "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  if (typeof window === "undefined") return new Uint8Array(Buffer.from(value, "base64"));
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function encryptPayload(data: unknown, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(secret);
  const encryptedWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(data)),
    ),
  );
  const tag = encryptedWithTag.slice(encryptedWithTag.length - AUTH_TAG_LENGTH);
  const encrypted = encryptedWithTag.slice(0, encryptedWithTag.length - AUTH_TAG_LENGTH);
  const merged = new Uint8Array(iv.length + AUTH_TAG_LENGTH + encrypted.length);
  merged.set(iv, 0);
  merged.set(tag, iv.length);
  merged.set(encrypted, iv.length + AUTH_TAG_LENGTH);
  return { payload: toBase64(merged) };
}

export async function decryptPayload<T>(payload: string, secret: string): Promise<T> {
  const merged = fromBase64(payload);
  const iv = merged.slice(0, IV_LENGTH);
  const tag = merged.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = merged.slice(IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedWithTag = new Uint8Array(encrypted.length + tag.length);
  encryptedWithTag.set(encrypted, 0);
  encryptedWithTag.set(tag, encrypted.length);
  const key = await getKey(secret);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedWithTag);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
