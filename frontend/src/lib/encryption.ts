const encoder = new TextEncoder();
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const AES_KEY_LENGTH = 32;

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

function toPemBody(value: string): string {
  return value
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
}

async function importBackendPublicKey(pemOrBase64: string): Promise<CryptoKey> {
  const normalized = toPemBody(pemOrBase64);
  const bytes = fromBase64(normalized);
  return crypto.subtle.importKey(
    "spki",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
}

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function getSymmetricKeyFromSecret(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export type ClientEncryptedEnvelope = {
  payload: string;
  transportKey?: string;
  rawTransportKey: string;
};

export async function encryptPayload(data: unknown, keyMaterial: string): Promise<ClientEncryptedEnvelope> {
  const useAsymmetric = keyMaterial.includes("BEGIN PUBLIC KEY") || keyMaterial.length > 120;
  if (!useAsymmetric) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const symmetricKey = await getSymmetricKeyFromSecret(keyMaterial);
    const encryptedWithTag = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, symmetricKey, encoder.encode(JSON.stringify(data))),
    );
    const tag = encryptedWithTag.slice(encryptedWithTag.length - AUTH_TAG_LENGTH);
    const encrypted = encryptedWithTag.slice(0, encryptedWithTag.length - AUTH_TAG_LENGTH);
    const merged = new Uint8Array(iv.length + AUTH_TAG_LENGTH + encrypted.length);
    merged.set(iv, 0);
    merged.set(tag, iv.length);
    merged.set(encrypted, iv.length + AUTH_TAG_LENGTH);
    const rawTransportKey = toBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(keyMaterial))));
    return { payload: toBase64(merged), rawTransportKey };
  }

  const transportKey = crypto.getRandomValues(new Uint8Array(AES_KEY_LENGTH));
  const aesKey = await importAesKey(transportKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encoder.encode(JSON.stringify(data)),
    ),
  );
  const tag = encryptedWithTag.slice(encryptedWithTag.length - AUTH_TAG_LENGTH);
  const encrypted = encryptedWithTag.slice(0, encryptedWithTag.length - AUTH_TAG_LENGTH);
  const merged = new Uint8Array(iv.length + AUTH_TAG_LENGTH + encrypted.length);
  merged.set(iv, 0);
  merged.set(tag, iv.length);
  merged.set(encrypted, iv.length + AUTH_TAG_LENGTH);
  const publicKey = await importBackendPublicKey(backendPublicKeyPem);
  const encryptedTransportKey = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      transportKey.buffer.slice(transportKey.byteOffset, transportKey.byteOffset + transportKey.byteLength),
    ),
  );
  return { payload: toBase64(merged), transportKey: toBase64(encryptedTransportKey), rawTransportKey: toBase64(transportKey) };
}

export async function decryptPayload<T>(payload: string, rawTransportKeyBase64: string): Promise<T> {
  const merged = fromBase64(payload);
  const iv = merged.slice(0, IV_LENGTH);
  const tag = merged.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = merged.slice(IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedWithTag = new Uint8Array(encrypted.length + tag.length);
  encryptedWithTag.set(encrypted, 0);
  encryptedWithTag.set(tag, encrypted.length);
  const rawTransportKey = fromBase64(rawTransportKeyBase64);
  const key = await importAesKey(rawTransportKey);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedWithTag);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
