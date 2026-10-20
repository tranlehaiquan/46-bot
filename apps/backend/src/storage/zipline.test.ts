import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeZiplineUrl,
  uploadImageToZipline,
  testZiplineConnection,
} from "./zipline.js";

describe("Zipline Storage Client", () => {
  describe("normalizeZiplineUrl", () => {
    it("strips trailing slashes and whitespace", () => {
      assert.equal(normalizeZiplineUrl("  https://zipline.example.com/  "), "https://zipline.example.com");
      assert.equal(normalizeZiplineUrl("https://zipline.example.com///"), "https://zipline.example.com");
    });
  });

  describe("uploadImageToZipline", () => {
    it("throws error if URL or token is missing", async () => {
      await assert.rejects(
        uploadImageToZipline({
          buffer: Buffer.from("dummy"),
          url: "",
          token: "secret",
        }),
        /Cấu hình Zipline chưa đầy đủ/,
      );

      await assert.rejects(
        uploadImageToZipline({
          buffer: Buffer.from("dummy"),
          url: "https://zipline.example.com",
          token: "  ",
        }),
        /Cấu hình Zipline chưa đầy đủ/,
      );
    });

    it("successfully uploads and parses JSON response with files array", async () => {
      let requestedUrl = "";
      let authHeader = "";
      let method = "";

      const mockFetch: typeof fetch = async (url, init) => {
        requestedUrl = String(url);
        method = init?.method || "";
        const headers = init?.headers as Record<string, string>;
        authHeader = headers?.authorization || "";

        return new Response(
          JSON.stringify({
            files: ["https://zipline.example.com/u/photo_123.png"],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const result = await uploadImageToZipline({
        buffer: Buffer.from("fake-png-content"),
        filename: "test.png",
        mimeType: "image/png",
        url: "https://zipline.example.com/",
        token: "my-token",
        fetchFn: mockFetch,
      });

      assert.equal(requestedUrl, "https://zipline.example.com/api/upload");
      assert.equal(method, "POST");
      assert.equal(authHeader, "my-token");
      assert.equal(result.url, "https://zipline.example.com/u/photo_123.png");
    });

    it("parses JSON response with object file url", async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            files: [{ url: "https://zipline.example.com/u/obj_photo.png" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const result = await uploadImageToZipline({
        buffer: Buffer.from("fake-png-content"),
        url: "https://zipline.example.com",
        token: "my-token",
        fetchFn: mockFetch,
      });

      assert.equal(result.url, "https://zipline.example.com/u/obj_photo.png");
    });

    it("parses raw text response", async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response("https://zipline.example.com/u/raw_photo.png\n", {
          status: 200,
        });
      };

      const result = await uploadImageToZipline({
        buffer: Buffer.from("fake-png-content"),
        url: "https://zipline.example.com",
        token: "my-token",
        fetchFn: mockFetch,
      });

      assert.equal(result.url, "https://zipline.example.com/u/raw_photo.png");
    });

    it("throws detailed error on non-OK response", async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response("Unauthorized token", { status: 401 });
      };

      await assert.rejects(
        uploadImageToZipline({
          buffer: Buffer.from("fake-png-content"),
          url: "https://zipline.example.com",
          token: "bad-token",
          fetchFn: mockFetch,
        }),
        /Zipline upload thất bại \(401\): Unauthorized token/,
      );
    });

    it("throws error on network failure", async () => {
      const mockFetch: typeof fetch = async () => {
        throw new Error("Connection refused");
      };

      await assert.rejects(
        uploadImageToZipline({
          buffer: Buffer.from("fake-png-content"),
          url: "https://zipline.example.com",
          token: "token",
          fetchFn: mockFetch,
        }),
        /Lỗi kết nối khi tải ảnh lên Zipline: Connection refused/,
      );
    });
  });

  describe("testZiplineConnection", () => {
    it("returns error if missing URL or token", async () => {
      const res = await testZiplineConnection({ url: "", token: "" });
      assert.equal(res.success, false);
      assert.match(res.error || "", /không được để trống/);
    });

    it("succeeds when /api/user returns 200", async () => {
      const mockFetch: typeof fetch = async (url) => {
        if (String(url).endsWith("/api/user")) {
          return new Response(JSON.stringify({ username: "admin" }), { status: 200 });
        }
        return new Response("Not Found", { status: 404 });
      };

      const res = await testZiplineConnection({
        url: "https://zipline.example.com",
        token: "valid-token",
        fetchFn: mockFetch,
      });

      assert.equal(res.success, true);
      assert.match(res.message || "", /Kết nối Zipline thành công/);
    });

    it("reports unauthorized when token is invalid", async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response("Invalid token", { status: 401 });
      };

      const res = await testZiplineConnection({
        url: "https://zipline.example.com",
        token: "invalid-token",
        fetchFn: mockFetch,
      });

      assert.equal(res.success, false);
      assert.match(res.error || "", /Token không hợp lệ/);
    });

    it("handles fallback to /api/upload if /api/user is 404", async () => {
      const mockFetch: typeof fetch = async (url) => {
        if (String(url).endsWith("/api/user")) {
          return new Response("Not Found", { status: 404 });
        }
        return new Response("Method Not Allowed", { status: 405 });
      };

      const res = await testZiplineConnection({
        url: "https://zipline.example.com",
        token: "valid-token",
        fetchFn: mockFetch,
      });

      assert.equal(res.success, true);
    });
  });
});
