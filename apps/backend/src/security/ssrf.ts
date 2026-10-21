import dns from "node:dns";
import net from "node:net";

export type LookupFn = (hostname: string) => Promise<{ address: string; family: number }[]>;

/**
 * Checks if an IPv4 address is in a private, loopback, link-local, or broadcast range.
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // invalid -> block
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (current network)
  if (a === 0) return true;

  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (private)
  if (a === 10) return true;

  // 172.16.0.0/12 (private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (private)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (link-local / AWS/GCP metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 (carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 224.0.0.0/4 (multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (reserved) & 255.255.255.255 (broadcast)
  if (a >= 240) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in a loopback, unique local, or link-local range.
 */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // ::1 loopback, :: unspecified
  if (normalized === "::1" || normalized === "::") return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.startsWith("::ffff:")) {
    const rest = normalized.slice(7);
    if (net.isIPv4(rest)) {
      return isPrivateOrReservedIPv4(rest);
    }
  }

  // fc00::/7 (Unique Local Address)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // fe80::/10 (Link-Local)
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL and checks that neither its hostname nor resolved IP addresses
 * point to private, loopback, or cloud-metadata endpoints.
 *
 * Throws an Error if the URL is not permitted.
 */
export async function validateSafeUrl(
  inputUrl: string,
  lookupFn: LookupFn = async (h) => dns.promises.lookup(h, { all: true }),
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    throw new Error(`Đường dẫn không hợp lệ: ${inputUrl}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Giao thức không được hỗ trợ (chỉ chấp nhận http hoặc https): ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase().trim();
  if (!hostname) {
    throw new Error("Tên miền hoặc địa chỉ máy chủ trống");
  }

  // Check forbidden domain patterns
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error(`Không được phép truy cập mạng nội bộ hoặc máy chủ cục bộ: ${hostname}`);
  }

  const rawHost = hostname.replace(/^\[|\]$/g, "");

  // Direct IP checks
  if (net.isIPv4(rawHost)) {
    if (isPrivateOrReservedIPv4(rawHost)) {
      throw new Error(`Không được phép truy cập dải địa chỉ IP nội bộ: ${hostname}`);
    }
    return parsed;
  }

  if (net.isIPv6(rawHost)) {
    if (isPrivateOrReservedIPv6(rawHost)) {
      throw new Error(`Không được phép truy cập dải địa chỉ IPv6 nội bộ: ${hostname}`);
    }
    return parsed;
  }

  // Resolve hostname
  try {
    const addresses = await lookupFn(hostname);
    if (!addresses || addresses.length === 0) {
      throw new Error(`Không tìm thấy địa chỉ IP cho tên miền: ${hostname}`);
    }

    for (const record of addresses) {
      if (net.isIPv4(record.address) && isPrivateOrReservedIPv4(record.address)) {
        throw new Error(`Tên miền ${hostname} trỏ về địa chỉ nội bộ (${record.address})`);
      }
      if (net.isIPv6(record.address) && isPrivateOrReservedIPv6(record.address)) {
        throw new Error(`Tên miền ${hostname} trỏ về địa chỉ IPv6 nội bộ (${record.address})`);
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes("Không được phép truy cập")) {
      throw err;
    }
    if (err.message && err.message.includes("trỏ về địa chỉ")) {
      throw err;
    }
    throw new Error(`Lỗi phân giải tên miền ${hostname}: ${err.message || String(err)}`);
  }

  return parsed;
}
