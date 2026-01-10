import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname || "";
  const isLocalhost =
    LOCAL_HOSTS.has(hostname) ||
    hostname === "localhost" ||
    hostname.startsWith("127.0.0.1") ||
    hostname.startsWith("::1");

  // Production: force secure cookies even if proxy headers are missing (PWA/WKWebView can drop them)
  // Localhost: allow non-secure for development.
  const isSecure = !isLocalhost || isSecureRequest(req);

  return {
    httpOnly: true,
    path: "/",
    // Use "lax" for PWA/WKWebView reliability; we are same-origin only.
    sameSite: "lax",
    secure: isSecure,
    domain: undefined,
  };
}
