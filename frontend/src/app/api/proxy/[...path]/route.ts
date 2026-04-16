import { NextRequest, NextResponse } from "next/server";

import { decryptServerPayload, encryptServerPayload } from "@/lib/server-encryption";

const backendBaseUrl = process.env.BACKEND_API_URL ?? "http://localhost:4000";
const clientSecret =
  process.env.CLIENT_ENCRYPTION_SECRET ??
  process.env.NEXT_PUBLIC_CLIENT_ENCRYPTION_SECRET ??
  "frontend-dev-secret";
const backendSecret = process.env.BACKEND_ENCRYPTION_SECRET ?? "backend-dev-secret";

async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const params = await context.params;
    const targetPath = params.path.join("/");
    const targetUrl = new URL(`${backendBaseUrl}/${targetPath}`);
    req.nextUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));

    let plainBody: unknown = {};
    let forwardedBody: BodyInit | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      let incoming: { payload?: string } | null = null;
      try {
        incoming = (await req.json()) as { payload?: string } | null;
      } catch {
        // Body is empty or not JSON — treat as empty object
        incoming = null;
      }
      plainBody = incoming ?? {};
      if (incoming?.payload) {
        try {
          plainBody = decryptServerPayload(incoming.payload, clientSecret);
        } catch {
          return NextResponse.json({ message: "Invalid encrypted request payload" }, { status: 400 });
        }
      }
      forwardedBody = JSON.stringify(encryptServerPayload(plainBody, backendSecret));
    }

    const requestIsReadOnly = req.method === "GET" || req.method === "HEAD";
    const callBackend = async (useEncryption: boolean) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        authorization: req.headers.get("authorization") ?? "",
      };
      if (useEncryption) {
        headers["x-encrypted"] = "1";
      }

      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: requestIsReadOnly
          ? undefined
          : useEncryption
            ? forwardedBody
            : JSON.stringify(plainBody),
        cache: "no-store",
      });

      const json = (await parseJsonSafely(response)) as { payload?: string; message?: string } | null;
      return { response, json };
    };

    let backendResponse: Response;
    let backendJson: { payload?: string; message?: string } | null;
    try {
      ({ response: backendResponse, json: backendJson } = await callBackend(true));
    } catch {
      return NextResponse.json({ message: "Could not reach the backend. Please try again later." }, { status: 502 });
    }

    const shouldFallbackToPlain =
      backendResponse.status === 400 &&
      backendJson &&
      typeof backendJson === "object" &&
      backendJson.message === "Invalid encrypted payload";

    let plain: unknown;
    let responseDecryptFailed = false;
    try {
      plain = backendJson?.payload
        ? decryptServerPayload<Record<string, unknown> | unknown[]>(backendJson.payload, backendSecret)
        : backendJson;
    } catch {
      responseDecryptFailed = true;
      plain = backendJson;
    }

    // Global fallback for all APIs: retry plain when encrypted request/response path breaks.
    if (shouldFallbackToPlain || responseDecryptFailed) {
      try {
        ({ response: backendResponse, json: backendJson } = await callBackend(false));
        plain = backendJson;
      } catch {
        return NextResponse.json({ message: "Could not reach the backend. Please try again later." }, { status: 502 });
      }
    }

    if (plain === null) {
      return new NextResponse(null, { status: backendResponse.status });
    }

    return NextResponse.json(encryptServerPayload(plain, clientSecret), {
      status: backendResponse.status,
    });
  } catch (err) {
    console.error("[proxy] unexpected error", err);
    return NextResponse.json({ message: "Proxy error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(req, context);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(req, context);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(req, context);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(req, context);
}
