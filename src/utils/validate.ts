export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Throws ValidationError if value is undefined, null, or an empty/whitespace string. */
export function requireString(field: string, value: unknown): string {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new ValidationError(`${field} is required`);
  }
  return String(value).trim();
}

/** Throws ValidationError if value is present but not one of the allowed enum members. */
export function requireEnum<T extends string>(field: string, value: unknown, allowed: readonly T[]): T {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new ValidationError(`${field} is required`);
  }
  if (!allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

/** Validates an optional enum — only throws if the value is present and invalid. */
export function optionalEnum<T extends string>(field: string, value: unknown, allowed: readonly T[]): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (!allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

/** Throws ValidationError if value is not a finite number ≥ 0. */
export function requireNonNegativeNumber(field: string, value: unknown): number {
  const n = Number(value);
  if (value === undefined || value === null || value === "" || !isFinite(n) || n < 0) {
    throw new ValidationError(`${field} must be a non-negative number`);
  }
  return n;
}

/** Validates an optional non-negative number. */
export function optionalNonNegativeNumber(field: string, value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!isFinite(n) || n < 0) {
    throw new ValidationError(`${field} must be a non-negative number`);
  }
  return n;
}

/** Validates an optional date string — returns a Date if present, null if absent, throws if malformed. */
export function parseOptionalDate(field: string, value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  const d = new Date(value as string);
  if (isNaN(d.getTime())) {
    throw new ValidationError(`${field} must be a valid date string`);
  }
  return d;
}

/** Throws ValidationError if value is absent or malformed date string. */
export function requireDate(field: string, value: unknown): Date {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new ValidationError(`${field} is required`);
  }
  const d = new Date(value as string);
  if (isNaN(d.getTime())) {
    throw new ValidationError(`${field} must be a valid date string`);
  }
  return d;
}

/** Simple RFC-5322-compatible email test. */
export function requireEmail(field: string, value: unknown): string {
  const str = requireString(field, value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    throw new ValidationError(`${field} must be a valid email address`);
  }
  return str;
}

/** Throws if string is shorter than minLen characters. */
export function requireMinLength(field: string, value: string, minLen: number): string {
  if (value.length < minLen) {
    throw new ValidationError(`${field} must be at least ${minLen} characters`);
  }
  return value;
}
