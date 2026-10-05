import { createHash, timingSafeEqual } from "node:crypto";

export function secretsMatch(header: string | undefined, secret: string): boolean {
  const headerDigest = createHash("sha256").update(header ?? "", "utf8").digest();
  const secretDigest = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(headerDigest, secretDigest);
}
