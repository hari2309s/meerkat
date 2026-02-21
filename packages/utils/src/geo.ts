const GEO_TIMEOUT_MS = 5_000;

/**
 * Returns true for loopback, link-local, and RFC-1918 private addresses.
 * Also handles Postgres's CIDR-suffixed inet format ("1.2.3.4/32").
 */
export function isPrivateIp(rawIp: string): boolean {
  const ip = rawIp?.split("/")[0]?.trim() ?? "";
  if (!ip) return true;
  if (ip === "::1") return true; // IPv6 loopback
  if (ip === "127.0.0.1") return true; // IPv4 loopback
  if (ip.startsWith("192.168.")) return true; // RFC-1918
  if (ip.startsWith("10.")) return true; // RFC-1918
  // 172.16.0.0/12 → 172.16.x.x – 172.31.x.x
  const m = ip.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

/**
 * Strips the optional CIDR prefix that Postgres appends to inet columns
 * (e.g. "1.2.3.4/32" → "1.2.3.4").
 */
export function normaliseIp(rawIp: string): string {
  return rawIp?.split("/")[0]?.trim() ?? "";
}

/**
 * Resolve a raw IP address to a human-readable location string.
 *
 * Returns "Local network" for private/loopback IPs, falls back to the raw IP
 * (or an empty string) on any error or timeout.
 *
 * @param rawIp - The IP address, optionally CIDR-suffixed (Postgres inet).
 */
export async function getLocation(rawIp: string): Promise<string> {
  if (isPrivateIp(rawIp)) return "Local network";

  const ip = normaliseIp(rawIp);
  if (!ip) return "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,regionName,country`,
      { cache: "no-store", signal: controller.signal },
    );

    if (!res.ok) return ip;

    const data = (await res.json()) as {
      status: string;
      city?: string;
      regionName?: string;
      country?: string;
    };

    if (data.status !== "success") return ip;

    return (
      [data.city, data.regionName, data.country].filter(Boolean).join(", ") ||
      ip
    );
  } catch {
    // AbortError (timeout) or network failure
    return ip;
  } finally {
    clearTimeout(timer);
  }
}
