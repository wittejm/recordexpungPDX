/**
 * Which deployment the app is running on, and what is turned on there.
 *
 * Tiers are read from the hostname, which is the only signal available to a static build:
 * the frontend is compiled once into an image that is deployed to both staging and
 * production. Anything unrecognized is treated as production, so a new domain hides
 * unreleased work.
 */

export type Tier = "local" | "staging" | "production";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"];

// config/nginx/recordexpunge-nginx.dev.conf
const STAGING_HOSTNAMES = ["dev.recordsponge.com"];

export function resolveTier(hostname: string): Tier {
  if (LOCAL_HOSTNAMES.includes(hostname)) return "local";
  if (STAGING_HOSTNAMES.includes(hostname)) return "staging";
  return "production";
}

/**
 * The SB-819 eligibility analysis, which is not released to recordsponge.com.
 *
 * `REACT_APP_SB819` overrides the tier when set at build time, for a preview deploy or a
 * developer serving the app from something other than localhost.
 */
export function sb819IsEnabled(
  hostname: string = window.location.hostname,
  override: string | undefined = process.env.REACT_APP_SB819
): boolean {
  if (override === "true") return true;
  if (override === "false") return false;
  return resolveTier(hostname) !== "production";
}
