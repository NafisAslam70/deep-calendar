import { NextRequest, NextResponse } from "next/server";

const ALLOW_ORIGINS = ["*"]; // later: lock down to your domains

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.nextUrl.pathname.startsWith("/api/")) return res;

  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOW_ORIGINS.includes("*") ? "*" : (ALLOW_ORIGINS.includes(origin) ? origin : "");
  res.headers.set("Access-Control-Allow-Origin", allowOrigin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }
  return res;
}

export const config = { matcher: ["/api/:path*"] };
