import { NextRequest, NextResponse } from "next/server";

import { decryptServerPayload, encryptServerPayload } from "@/lib/server-encryption";

const backendBaseUrl = process.env.BACKEND_API_URL ?? "http://localhost:4000";
const clientSecret = process.env.CLIENT_ENCRYPTION_SECRET ?? "frontend-dev-secret";
const backendSecret = process.env.BACKEND_ENCRYPTION_SECRET ?? "backend-dev-secret";

async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const params = await context.params;
    const targetPath = params.path.join("/");
    const targetUrl = new URL(`${backendBaseUrl}/${targetPath}`);
    req.nextUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));

    let forwardedBody: BodyInit | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      let incoming: { payload?: string } | null = null;
      try {
        incoming = (await req.json()) as { payload?: string } | null;
      } catch {
        // Body is empty or not JSON — treat as empty object
        incoming = null;
      }
      let plainBody: unknown = incoming ?? {};
      if (incoming?.payload) {
        try {
          plainBody = decryptServerPayload(incoming.payload, clientSecret);
        } catch {
          return NextResponse.json({ message: "Invalid encrypted request payload" }, { status: 400 });
        }
      }
      forwardedBody = JSON.stringify(encryptServerPayload(plainBody, backendSecret));
    }

    let backendResponse: Response;
    try {
      backendResponse = await fetch(targetUrl, {
        method: req.method,
        headers: {
          "content-type": "application/json",
          "x-encrypted": "1",
          authorization: req.headers.get("authorization") ?? "",
        },
        body: forwardedBody,
        cache: "no-store",
      });
    } catch {
      return NextResponse.json({ message: "Could not reach the backend. Please try again later." }, { status: 502 });
    }

    let plain: unknown;
    try {
      const backendJson = (await backendResponse.json()) as { payload?: string };
      plain = backendJson?.payload
        ? decryptServerPayload<Record<string, unknown> | unknown[]>(backendJson.payload, backendSecret)
        : backendJson;
    } catch {
      // Backend returned empty body (e.g. 204 No Content) or non-JSON
      plain = null;
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
