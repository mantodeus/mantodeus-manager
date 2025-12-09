import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname || "";
  const isLocalhost = LOCAL_HOSTS.has(hostname) || hostname === "localhost" || hostname.startsWith("127.0.0.1") || hostname.startsWith("::1");
  
  // For localhost development: use lax, non-secure
  // For production HTTPS: use none, secure
  const isSecure = !isLocalhost && (isSecureRequest(req) || process.env.NODE_ENV === "production");
  
  if (process.env.NODE_ENV === "development") {
    console.log(`[Cookies] Hostname: ${hostname}, isLocalhost: ${isLocalhost}, isSecure: ${isSecure}`);
  }
  
  return {
    httpOnly: true,
    path: "/",
    sameSite: isSecure ? "none" : "lax", // Use "lax" for localhost/dev, "none" for HTTPS production
    secure: isSecure,
    // Don't set domain for localhost - let browser handle it
    domain: undefined,
  };
}
