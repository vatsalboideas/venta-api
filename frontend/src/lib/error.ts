"use client";

type ApiErrorShape = {
  status?: number | string;
  data?: unknown;
  error?: string;
};

function isApiErrorShape(value: unknown): value is ApiErrorShape {
  return Boolean(value) && typeof value === "object";
}

function deriveFriendlyMessage(error: unknown): string {
  const fallback = "Something went wrong. Please try again.";
  if (!isApiErrorShape(error)) return fallback;

  const { status, data, error: rawError } = error;

  if (typeof data === "object" && data !== null) {
    const dataMessage = (data as { message?: unknown }).message;
    if (typeof dataMessage === "string" && dataMessage.trim()) {
      return dataMessage;
    }
  }

  if (status === 401 || status === 403) return "Your session expired. Please sign in again.";
  if (status === 404) return "The requested record was not found.";
  if (status === 409) return "This action conflicts with existing data.";
  if (status === 422 || status === 400) return "Please check your input and try again.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return "Server is having trouble right now. Please try again shortly.";
  }

  if (typeof rawError === "string" && rawError.trim()) {
    return "Request failed. Please try again.";
  }

  return fallback;
}

function extractTechnicalDetails(error: unknown) {
  if (!isApiErrorShape(error)) return { raw: error };

  const details: Record<string, unknown> = {
    status: error.status,
    error: error.error,
  };

  if (typeof error.data === "object" && error.data !== null) {
    const data = error.data as Record<string, unknown>;
    details.data = {
      message: data.message,
      code: data.code,
      details: data.details,
    };
  } else {
    details.data = error.data;
  }

  return details;
}

export function getErrorMessage(error: unknown, context?: string): string {
  const message = deriveFriendlyMessage(error);
  const prefix = context ? `[UI Error] ${context}` : "[UI Error]";
  const technical = extractTechnicalDetails(error);

  // Use warning-level logs to avoid noisy dev overlays from console.error.
  console.warn(prefix, {
    message,
    technical,
    timestamp: new Date().toISOString(),
  });

  return message;
}
