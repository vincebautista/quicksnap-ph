import { NextRequest, NextResponse } from "next/server";

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowedOrigins = parseAllowedOrigins();
  return allowedOrigins.includes(origin);
}

function getCorsHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const origin = request.headers.get("origin");

  if (isAllowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin!);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
  headers.set("Access-Control-Max-Age", "86400");

  return headers;
}

function unauthorized(
  headers: Headers,
  message = "Unauthorized"
): NextResponse {
  return NextResponse.json({ error: message }, { status: 401, headers });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const corsHeaders = getCorsHeaders(request);

  if (method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // Cron endpoints must always be called with CRON_SECRET.
  if (pathname.startsWith("/api/cron/")) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return unauthorized(corsHeaders);
    }

    const response = NextResponse.next();
    corsHeaders.forEach((value, key) => response.headers.set(key, value));
    return response;
  }

  // Allow same-origin browser calls from this app without extra token.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const expectedOrigin = host ? `${request.nextUrl.protocol}//${host}` : null;
  const isSameOrigin = !!origin && !!expectedOrigin && origin === expectedOrigin;

  // Cross-origin / server-to-server calls require API_AUTH_TOKEN.
  if (!isSameOrigin) {
    if (!process.env.API_AUTH_TOKEN) {
      return unauthorized(corsHeaders, "API_AUTH_TOKEN is not configured");
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.API_AUTH_TOKEN}`) {
      return unauthorized(corsHeaders);
    }
  }

  const response = NextResponse.next();
  corsHeaders.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
