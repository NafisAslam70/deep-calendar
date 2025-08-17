// import { NextRequest, NextResponse } from "next/server";

// const ALLOW_ORIGINS = ["*"]; // later: lock down to your domains

// export function middleware(req: NextRequest) {
//   const res = NextResponse.next();
//   if (!req.nextUrl.pathname.startsWith("/api/")) return res;

//   const origin = req.headers.get("origin") || "";
//   const allowOrigin = ALLOW_ORIGINS.includes("*") ? "*" : (ALLOW_ORIGINS.includes(origin) ? origin : "");
//   res.headers.set("Access-Control-Allow-Origin", allowOrigin);
//   res.headers.set("Vary", "Origin");
//   res.headers.set("Access-Control-Allow-Credentials", "true");
//   res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
//   res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

//   if (req.method === "OPTIONS") {
//     return new NextResponse(null, { status: 204, headers: res.headers });
//   }
//   return res;
// }

// export const config = { matcher: ["/api/:path*"] };
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PUBLIC = /^\/api\/public\//;

// Treat localhost, 127.0.0.1, and any IPv4 LAN as "dev"
function isLocalOrigin(origin: string) {
  try {
    const u = new URL(origin);
    const h = u.hostname;
    return (
      h === "localhost" ||
      h === "127.0.0.1" ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(h) // 10.x.x.x, 192.168.x.x, etc
    );
  } catch {
    return false;
  }
}
function isVercelPreview(origin: string) {
  try {
    return new URL(origin).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

// Comma-separated list of allowed origins for production,
// e.g. "https://deep-calendar-...vercel.app,https://app.deepcalendar.com"
const EXTRA_ALLOWED = (process.env.CORS_TRUSTED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  const origin = req.headers.get("origin") || "";
  const isPublic = PUBLIC.test(req.nextUrl.pathname);
  const sameOrigin = origin && origin === req.nextUrl.origin;
  const inProd = process.env.NODE_ENV === "production";

  const headers = new Headers();
  headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Vary", "Origin");

  if (isPublic) {
    // Public, read-only endpoints can be wide open (no credentials)
    headers.set("Access-Control-Allow-Origin", "*");
  } else {
    // Private endpoints: only allow trusted origins and enable credentials
    let allow = "";
    if (sameOrigin) allow = origin;
    else if (!inProd && isLocalOrigin(origin)) allow = origin;            // dev: localhost/LAN
    else if (inProd && EXTRA_ALLOWED.includes(origin)) allow = origin;    // prod: env-configured
    else if (inProd && isVercelPreview(origin)) allow = origin;           // prod: preview deploys

    if (allow) {
      headers.set("Access-Control-Allow-Origin", allow);
      headers.set("Access-Control-Allow-Credentials", "true");
    } // else: not trusted → no cross-origin access
  }

  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  headers.forEach((v, k) => res.headers.set(k, v));
  return res;
}

export const config = { matcher: ["/api/:path*"] };
