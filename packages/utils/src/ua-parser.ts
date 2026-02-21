export interface UAResult {
  browser: string;
  os: string;
  device: string;
}

/**
 * Parse a User-Agent string into browser, OS, and device fields.
 * Returns "Unknown *" strings when the UA is null/empty.
 */
export function parseUA(ua: string | null | undefined): UAResult {
  if (!ua) {
    return { browser: "Unknown browser", os: "Unknown OS", device: "Unknown" };
  }

  // ── Browser ──────────────────────────────────────────────────────────────
  let browser = "Unknown browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/MSIE|Trident/.test(ua)) browser = "Internet Explorer";
  else if (/CriOS/.test(ua)) browser = "Chrome (iOS)";
  else if (/FxiOS/.test(ua)) browser = "Firefox (iOS)";

  // ── OS ────────────────────────────────────────────────────────────────────
  let os = "Unknown OS";
  if (/iPhone/.test(ua)) {
    os = "iOS (iPhone)";
  } else if (/iPad/.test(ua)) {
    os = "iOS (iPad)";
  } else if (/Android/.test(ua)) {
    const m = ua.match(/Android ([0-9.]+)/);
    os = m ? `Android ${m[1]}` : "Android";
  } else if (/Windows NT/.test(ua)) {
    const m = ua.match(/Windows NT ([0-9.]+)/);
    const versions: Record<string, string> = {
      "10.0": "Windows 11/10",
      "6.3": "Windows 8.1",
      "6.2": "Windows 8",
      "6.1": "Windows 7",
    };
    os = m ? (versions[m[1]!] ?? `Windows NT ${m[1]}`) : "Windows";
  } else if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X ([0-9_]+)/);
    os = m ? `macOS ${m[1]!.replace(/_/g, ".")}` : "macOS";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  }

  // ── Device ────────────────────────────────────────────────────────────────
  let device = "Desktop";
  if (/iPhone|iPod/.test(ua)) device = "iPhone";
  else if (/iPad/.test(ua)) device = "iPad";
  else if (/Android/.test(ua) && /Mobile/.test(ua)) device = "Android Phone";
  else if (/Android/.test(ua)) device = "Android Tablet";

  return { browser, os, device };
}
