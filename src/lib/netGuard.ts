import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Guards server-side fetches of admin-supplied addresses (Instagram source feed
// URLs) so they can't be pointed at the NAS itself or other devices on the home
// network. Not used for the bundled RSS-Bridge address or the fixed event sources.

/** True for loopback, private, link-local, CGNAT, unspecified and multicast addresses (IPv4 and IPv6). */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT (Tailscale lives here)
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast and reserved
    );
  }
  if (kind === 6) {
    if (ip === "::" || ip === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith("ff"); // unique-local, link-local, multicast
  }
  return false;
}

export class PrivateAddressError extends Error {}

/** Throws PrivateAddressError unless every address the URL's host points to is public. */
export async function assertPublicUrl(url: string): Promise<void> {
  const { hostname } = new URL(url);
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new PrivateAddressError(host);
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new PrivateAddressError(host);
    return;
  }
  const addresses = await lookup(host, { all: true });
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new PrivateAddressError(host);
}
