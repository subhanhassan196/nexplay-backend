import type { Response } from "express";
import { env } from "@/config/env";

export const ACCESS_TOKEN_COOKIE = "nexplay_access_token";
export const REFRESH_TOKEN_COOKIE = "nexplay_refresh_token";

/**
 * Auth cookie configuration.
 *
 * Three deployment shapes have to work, and they need different settings:
 *
 *  1. localhost / LAN IP over HTTP — plain cookie, `secure` must be OFF or
 *     the browser silently drops it and every request looks logged-out.
 *  2. Frontend and API on the SAME site (e.g. app.example.com +
 *     api.example.com) — `sameSite: lax` with a shared parent domain.
 *  3. Frontend and API on DIFFERENT sites (e.g. *.vercel.app calling
 *     *.onrender.com) — this is cross-site, so the browser will refuse to
 *     send a `lax` cookie at all. It requires `sameSite: none` + `secure`.
 *
 * Case 3 is the one that silently breaks deploys: login returns 200, the
 * cookie never sticks, and the user bounces straight back to the login
 * page. So we detect it rather than hardcoding one policy.
 */
function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** Strips a leading subdomain so app.foo.com and api.foo.com match. */
function registrableDomain(host: string): string {
  const parts = host.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : host;
}

const clientHost = hostOf(env.CLIENT_URL);
const apiHost = hostOf(env.API_URL);

const isLocalHost = /^(localhost|127\.|10\.|192\.168\.|172\.)/.test(clientHost) || clientHost === "";

// Different registrable domains ⇒ the browser treats this as cross-site.
const isCrossSite =
  !isLocalHost && clientHost !== "" && apiHost !== "" && registrableDomain(clientHost) !== registrableDomain(apiHost);

// A cookie domain is only valid if the API is actually served from it —
// setting someone else's domain makes the browser discard the cookie.
const configuredDomain = env.COOKIE_DOMAIN && env.COOKIE_DOMAIN !== "localhost" ? env.COOKIE_DOMAIN : "";
const domainIsUsable =
  configuredDomain !== "" && (apiHost === configuredDomain || apiHost.endsWith(`.${configuredDomain}`));

const baseCookieOptions = {
  httpOnly: true,
  // Cross-site cookies are only accepted over HTTPS, so `none` implies secure.
  secure: isCrossSite || domainIsUsable || env.COOKIE_SECURE,
  sameSite: (isCrossSite ? "none" : "lax") as "none" | "lax",
  domain: domainIsUsable ? configuredDomain : undefined,
  path: "/",
};

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

export function setAccessTokenCookie(res: Response, token: string) {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
}

export function setRefreshTokenCookie(res: Response, token: string, rememberMe: boolean) {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...baseCookieOptions,
    maxAge,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_TOKEN_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, baseCookieOptions);
}
