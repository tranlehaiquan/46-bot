import crypto from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

export function createToken(password: string): string {
  const payload = {
    role: "admin",
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", password).update(body).digest("base64url");
  return `${body}.${hmac}`;
}

export function verifyToken(token: string, password: string): boolean {
  if (!token || !password) return false;
  if (token === password) {
    return true;
  }
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [body, hmac] = parts;
  try {
    const expectedHmac = crypto.createHmac("sha256", password).update(body).digest("base64url");
    const hmacBuf = Buffer.from(hmac);
    const expectedBuf = Buffer.from(expectedHmac);
    if (hmacBuf.length !== expectedBuf.length) return false;
    if (!crypto.timingSafeEqual(hmacBuf, expectedBuf)) {
      return false;
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      role?: string;
      exp?: number;
    };
    if (typeof payload.exp === "number" && payload.exp < Date.now()) {
      return false;
    }
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export function createAuthHook(adminPassword: string) {
  return async function requireAdminAuth(request: FastifyRequest, reply: FastifyReply) {
    if (request.url === "/api/admin/login") {
      return;
    }
    const authHeader = request.headers.authorization;
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (typeof request.headers["x-admin-token"] === "string") {
      token = request.headers["x-admin-token"].trim();
    }

    if (!token || !verifyToken(token, adminPassword)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  };
}
