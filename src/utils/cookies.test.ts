import { describe, it, expect } from "vitest";

/**
 * These mirror the cookie-policy logic in cookies.ts. The rules are easy
 * to get subtly wrong and the failure mode is nasty — login returns 200,
 * the cookie is silently dropped, and the user bounces back to the login
 * page with no error anywhere. Worth pinning down.
 */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function registrableDomain(host: string): string {
  const parts = host.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : host;
}

function policy(clientUrl: string, apiUrl: string, cookieDomain: string) {
  const clientHost = hostOf(clientUrl);
  const apiHost = hostOf(apiUrl);
  const isLocalHost = /^(localhost|127\.|10\.|192\.168\.|172\.)/.test(clientHost) || clientHost === "";
  const isCrossSite =
    !isLocalHost && clientHost !== "" && apiHost !== "" && registrableDomain(clientHost) !== registrableDomain(apiHost);
  const configured = cookieDomain && cookieDomain !== "localhost" ? cookieDomain : "";
  const domainIsUsable = configured !== "" && (apiHost === configured || apiHost.endsWith(`.${configured}`));

  return {
    sameSite: isCrossSite ? "none" : "lax",
    secure: isCrossSite || domainIsUsable,
    domain: domainIsUsable ? configured : undefined,
  };
}

describe("auth cookie policy", () => {
  it("keeps cookies insecure and lax on localhost", () => {
    const p = policy("http://localhost:3000", "http://localhost:5000", "localhost");
    expect(p.sameSite).toBe("lax");
    expect(p.secure).toBe(false);
    expect(p.domain).toBeUndefined();
  });

  it("keeps cookies working over a LAN IP", () => {
    const p = policy("http://192.168.18.65:3000", "http://192.168.18.65:5000", "localhost");
    expect(p.secure).toBe(false);
    expect(p.sameSite).toBe("lax");
  });

  it("uses sameSite=none when frontend and API are on different sites", () => {
    // Vercel frontend calling a Render API — the browser treats this as
    // cross-site and would drop a `lax` cookie entirely.
    const p = policy("https://nexplay-frontend.vercel.app", "https://nexplay-api.onrender.com", "");
    expect(p.sameSite).toBe("none");
    expect(p.secure).toBe(true);
  });

  it("ignores a cookie domain the API isn't served from", () => {
    // Setting someone else's domain makes the browser discard the cookie.
    const p = policy("https://nexplay-frontend.vercel.app", "https://nexplay-api.onrender.com", "thisismyweb.online");
    expect(p.domain).toBeUndefined();
  });

  it("uses a shared parent domain when both sides live under it", () => {
    const p = policy("https://thisismyweb.online", "https://api.thisismyweb.online", "thisismyweb.online");
    expect(p.sameSite).toBe("lax");
    expect(p.secure).toBe(true);
    expect(p.domain).toBe("thisismyweb.online");
  });
});
