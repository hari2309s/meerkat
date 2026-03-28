/**
 * Open a file attachment from either a URL or a base64 data URL.
 *
 * Browsers block navigating to data URLs in new tabs (security restriction
 * since Chrome 60). When the src is a data URL we convert it to an object
 * URL and trigger a download via a temporary <a> element instead.
 */
export function openAttachment(url: string, name: string): void {
  if (!url) return;
  if (url.startsWith("data:")) {
    const [header, b64] = url.split(",");
    const mime = header?.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
    const bytes = atob(b64 ?? "");
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    const blob = new Blob([buf], { type: mime });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
  } else {
    window.open(url, "_blank", "noreferrer");
  }
}
