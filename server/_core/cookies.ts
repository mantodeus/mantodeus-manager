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

  // Production: always use secure cookies unless explicitly localhost
  const isSecure = !isLocalhost && isSecureRequest(req);

  return {
    httpOnly: true,
    path: "/",
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
    domain: undefined,
  };
}
