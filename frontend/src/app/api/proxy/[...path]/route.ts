import { NextRequest, NextResponse } from "next/server";
import { decryptServerPayload, encryptServerPayload } from "@/lib/server-encryption";

const backendBaseUrl = process.env.BACKEND_API_URL ?? "http://localhost:4000";
const requireHttps = process.env.NODE_ENV === "production";
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
    const backendUrl = new URL(backendBaseUrl);
    if (requireHttps && backendUrl.protocol !== "https:") {
      return NextResponse.json({ message: "Backend API must use HTTPS in production" }, { status: 500 });
    }

    const params = await context.params;
    const targetPath = params.path.join("/");
    const targetUrl = new URL(`${backendBaseUrl}/${targetPath}`);
    req.nextUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));

    const transportKey = req.headers.get("x-transport-key");
    const useAsymmetricPassthrough = Boolean(transportKey);
    let plainBody: unknown = {};
    let forwardedBody: BodyInit | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      try {
        const incoming = (await req.json()) as { payload?: string } | null;
        if (useAsymmetricPassthrough) {
          forwardedBody = JSON.stringify(incoming);
        } else {
          plainBody = incoming ?? {};
          if (incoming?.payload) {
            plainBody = decryptServerPayload(incoming.payload, clientSecret);
          }
          forwardedBody = JSON.stringify(encryptServerPayload(plainBody, backendSecret));
        }
      } catch {
        forwardedBody = undefined;
      }
    }

    const requestIsReadOnly = req.method === "GET" || req.method === "HEAD";
    const callBackend = async () => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        authorization: req.headers.get("authorization") ?? "",
        "x-encrypted": "1",
      };
      if (transportKey) {
        headers["x-transport-key"] = transportKey;
      }

      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: requestIsReadOnly ? undefined : forwardedBody,
        cache: "no-store",
      });

      const json = (await parseJsonSafely(response)) as { payload?: string; message?: string } | null;
      return { response, json };
    };

    let backendResponse: Response;
    let backendJson: { payload?: string; message?: string } | null;
    try {
      ({ response: backendResponse, json: backendJson } = await callBackend());
    } catch {
      return NextResponse.json({ message: "Could not reach the backend. Please try again later." }, { status: 502 });
    }

    if (backendJson === null) {
      return new NextResponse(null, { status: backendResponse.status });
    }

    if (useAsymmetricPassthrough) {
      return NextResponse.json(backendJson, {
        status: backendResponse.status,
      });
    }

    const plain = backendJson?.payload
      ? decryptServerPayload<Record<string, unknown> | unknown[]>(backendJson.payload, backendSecret)
      : backendJson;
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
