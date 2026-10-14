import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  generateImouSign,
  ImouClient,
  ImouApiError,
} from "./imou-client.js";

describe("ImouClient & Signatures", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("generateImouSign", () => {
    it("generates correct MD5 signature in lowercase 32-char hex", () => {
      const time = 1700000000;
      const nonce = "test_nonce_123";
      const appSecret = "my_app_secret";
      const sign = generateImouSign(time, nonce, appSecret);

      assert.equal(typeof sign, "string");
      assert.equal(sign.length, 32);
      assert.match(sign, /^[a-f0-9]{32}$/);
      // Verify determinism
      assert.equal(sign, generateImouSign(time, nonce, appSecret));
    });
  });

  describe("Client Initialization", () => {
    it("throws if appId is missing", () => {
      assert.throws(
        () => new ImouClient({ appId: "", appSecret: "secret" }),
        /appId is required/,
      );
    });

    it("throws if appSecret is missing", () => {
      assert.throws(
        () => new ImouClient({ appId: "appId", appSecret: "" }),
        /appSecret is required/,
      );
    });

    it("normalizes trailing slash in baseUrl", () => {
      const client = new ImouClient({
        appId: "appId",
        appSecret: "secret",
        baseUrl: "https://openapi-sg.easy4ip.com/openapi///",
      });
      assert.equal(client.getBaseUrl(), "https://openapi-sg.easy4ip.com/openapi");
    });
  });

  describe("getAccessToken & Token Caching", () => {
    it("fetches access token and caches it for subsequent calls", async () => {
      let fetchCount = 0;
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.endsWith("/accessToken")) {
          fetchCount++;
          const body = JSON.parse(String(init?.body));
          assert.equal(body.system.appId, "test-app");
          assert.equal(typeof body.system.sign, "string");
          assert.equal(typeof body.system.time, "number");
          return new Response(
            JSON.stringify({
              code: "0",
              msg: "success",
              data: {
                accessToken: "token_abc_123",
                expireTime: 3600,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`Unexpected URL: ${urlStr}`);
      }) as typeof fetch;

      const client = new ImouClient({ appId: "test-app", appSecret: "test-secret" });
      const token1 = await client.getAccessToken();
      assert.equal(token1, "token_abc_123");
      assert.equal(fetchCount, 1);

      // Second call should hit in-memory cache
      const token2 = await client.getAccessToken();
      assert.equal(token2, "token_abc_123");
      assert.equal(fetchCount, 1);
    });

    it("throws ImouApiError when API responds with error code", async () => {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            code: "OP1001",
            msg: "AppId does not exist",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;

      const client = new ImouClient({ appId: "wrong-app", appSecret: "test-secret" });
      await assert.rejects(
        () => client.getAccessToken(),
        (err: unknown) => {
          assert.ok(err instanceof ImouApiError);
          assert.equal(err.code, "OP1001");
          assert.match(err.message, /AppId does not exist/);
          return true;
        },
      );
    });
  });

  describe("captureDeviceSnapshot", () => {
    it("captures snapshot via setDeviceSnapEnhanced and downloads image buffer", async () => {
      const sampleJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (urlStr.endsWith("/accessToken")) {
          return new Response(
            JSON.stringify({
              code: "0",
              data: { accessToken: "valid_token", expireTime: 7200 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (urlStr.endsWith("/setDeviceSnapEnhanced")) {
          return new Response(
            JSON.stringify({
              code: "0",
              data: { url: "https://lechange-cloud.example/snap123.jpg" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (urlStr === "https://lechange-cloud.example/snap123.jpg") {
          return new Response(sampleJpeg, {
            status: 200,
            headers: { "Content-Type": "image/jpeg" },
          });
        }
        throw new Error(`Unexpected URL: ${urlStr}`);
      }) as typeof fetch;

      const client = new ImouClient({ appId: "app", appSecret: "secret" });
      const result = await client.captureDeviceSnapshot("DEV999", "0");

      assert.equal(result.url, "https://lechange-cloud.example/snap123.jpg");
      assert.ok(Buffer.isBuffer(result.buffer));
      assert.deepEqual(result.buffer, sampleJpeg);
    });

    it("falls back to setDeviceSnap when setDeviceSnapEnhanced fails", async () => {
      const sampleJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
      let enhancedCalled = false;
      let standardCalled = false;

      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (urlStr.endsWith("/accessToken")) {
          return new Response(
            JSON.stringify({
              code: "0",
              data: { accessToken: "valid_token", expireTime: 7200 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (urlStr.endsWith("/setDeviceSnapEnhanced")) {
          enhancedCalled = true;
          return new Response(
            JSON.stringify({
              code: "DV1024",
              msg: "Device does not support enhanced snapshot",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (urlStr.endsWith("/setDeviceSnap")) {
          standardCalled = true;
          return new Response(
            JSON.stringify({
              code: "0",
              data: { url: "https://lechange-cloud.example/snap_standard.jpg" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (urlStr === "https://lechange-cloud.example/snap_standard.jpg") {
          return new Response(sampleJpeg, {
            status: 200,
            headers: { "Content-Type": "image/jpeg" },
          });
        }
        throw new Error(`Unexpected URL: ${urlStr}`);
      }) as typeof fetch;

      const client = new ImouClient({ appId: "app", appSecret: "secret" });
      const result = await client.captureDeviceSnapshot("DEV999", "0");

      assert.equal(enhancedCalled, true);
      assert.equal(standardCalled, true);
      assert.equal(result.url, "https://lechange-cloud.example/snap_standard.jpg");
      assert.deepEqual(result.buffer, sampleJpeg);
    });
  });

  describe("testConnection", () => {
    it("returns success with token preview when authentication succeeds", async () => {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            code: "0",
            data: { accessToken: "at_1234567890abcdef", expireTime: 3600 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;

      const client = new ImouClient({ appId: "test-app", appSecret: "secret" });
      const res = await client.testConnection();
      assert.equal(res.success, true);
      assert.match(res.message, /Kết nối thành công/);
      assert.equal(res.tokenPreview, "at_1...cdef");
    });

    it("returns failure when authentication fails", async () => {
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            code: "OP1002",
            msg: "Signature error",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;

      const client = new ImouClient({ appId: "test-app", appSecret: "wrong" });
      const res = await client.testConnection();
      assert.equal(res.success, false);
      assert.match(res.message, /Signature error/);
    });
  });
});
