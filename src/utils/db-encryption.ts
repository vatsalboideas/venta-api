import { decryptJson, encryptJson } from "./encryption";

const DB_ENCRYPTION_PREFIX = "dbenc:v1:";

const dbSecret = process.env.DB_ENCRYPTION_SECRET ?? "dev-db-encryption-secret-change-me";

export const DB_ENCRYPTED_FIELDS: Record<string, Set<string>> = {
  User: new Set(["twoFASecret", "phone"]),
  Brand: new Set(["website", "description"]),
  Contact: new Set(["address"]),
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isEncryptedDbValue(value: string): boolean {
  return value.startsWith(DB_ENCRYPTION_PREFIX);
}

export function encryptDbString(value: string): string {
  if (isEncryptedDbValue(value)) return value;
  return `${DB_ENCRYPTION_PREFIX}${encryptJson(value, dbSecret).payload}`;
}

export function decryptDbString(value: string): string {
  if (!isEncryptedDbValue(value)) return value;
  const payload = value.slice(DB_ENCRYPTION_PREFIX.length);
  return decryptJson<string>(payload, dbSecret);
}

export function decryptDbResult<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => decryptDbResult(item)) as T;
  }

  if (typeof value === "string") {
    return decryptDbString(value) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    next[key] = decryptDbResult(inner);
  }
  return next as T;
}

export function encryptDbWriteArgs(model: string, args: unknown): unknown {
  const fields = DB_ENCRYPTED_FIELDS[model];
  if (!fields) return args;
  if (!isObject(args)) return args;

  const nextArgs = { ...args };
  const data = nextArgs.data;
  if (data !== undefined) {
    nextArgs.data = encryptDataNode(data, fields);
  }
  return nextArgs;
}

function encryptDataNode(node: unknown, fields: Set<string>): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => encryptDataNode(item, fields));
  }
  if (!isPlainObject(node)) {
    return node;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined || value === null) {
      result[key] = value;
      continue;
    }

    if (fields.has(key) && typeof value === "string") {
      result[key] = encryptDbString(value);
      continue;
    }

    if (isPlainObject(value) || Array.isArray(value)) {
      result[key] = encryptDataNode(value, fields);
      continue;
    }

    result[key] = value;
  }

  return result;
}
