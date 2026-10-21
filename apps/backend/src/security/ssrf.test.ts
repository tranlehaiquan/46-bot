import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
  validateSafeUrl,
} from "./ssrf.js";

describe("security/ssrf", () => {
  describe("isPrivateOrReservedIPv4", () => {
    it("detects loopback addresses", () => {
      assert.equal(isPrivateOrReservedIPv4("127.0.0.1"), true);
      assert.equal(isPrivateOrReservedIPv4("127.255.255.255"), true);
    });

    it("detects 10.0.0.0/8 private range", () => {
      assert.equal(isPrivateOrReservedIPv4("10.0.0.1"), true);
      assert.equal(isPrivateOrReservedIPv4("10.254.1.5"), true);
    });

    it("detects 172.16.0.0/12 private range", () => {
      assert.equal(isPrivateOrReservedIPv4("172.16.0.1"), true);
      assert.equal(isPrivateOrReservedIPv4("172.31.255.255"), true);
      assert.equal(isPrivateOrReservedIPv4("172.32.0.1"), false); // Public
    });

    it("detects 192.168.0.0/16 private range", () => {
      assert.equal(isPrivateOrReservedIPv4("192.168.1.1"), true);
      assert.equal(isPrivateOrReservedIPv4("192.168.100.254"), true);
    });

    it("detects cloud metadata IP (169.254.169.254)", () => {
      assert.equal(isPrivateOrReservedIPv4("169.254.169.254"), true);
      assert.equal(isPrivateOrReservedIPv4("169.254.0.1"), true);
    });

    it("allows public IPv4 addresses", () => {
      assert.equal(isPrivateOrReservedIPv4("8.8.8.8"), false);
      assert.equal(isPrivateOrReservedIPv4("1.1.1.1"), false);
      assert.equal(isPrivateOrReservedIPv4("142.250.190.46"), false);
    });
  });

  describe("isPrivateOrReservedIPv6", () => {
    it("detects IPv6 loopback and unspecified", () => {
      assert.equal(isPrivateOrReservedIPv6("::1"), true);
      assert.equal(isPrivateOrReservedIPv6("::"), true);
    });

    it("detects IPv4-mapped IPv6 loopback", () => {
      assert.equal(isPrivateOrReservedIPv6("::ffff:127.0.0.1"), true);
      assert.equal(isPrivateOrReservedIPv6("::ffff:192.168.1.1"), true);
    });

    it("detects ULA (fc00::/7)", () => {
      assert.equal(isPrivateOrReservedIPv6("fc00::1"), true);
      assert.equal(isPrivateOrReservedIPv6("fd12:3456:789a::1"), true);
    });

    it("detects link-local (fe80::/10)", () => {
      assert.equal(isPrivateOrReservedIPv6("fe80::1"), true);
    });
  });

  describe("validateSafeUrl", () => {
    const mockPublicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
    const mockPrivateLookup = async () => [{ address: "192.168.1.50", family: 4 }];
    const mockCloudMetadataLookup = async () => [{ address: "169.254.169.254", family: 4 }];

    it("allows valid public HTTPS URL", async () => {
      const parsed = await validateSafeUrl("https://example.com/article/1", mockPublicLookup);
      assert.equal(parsed.hostname, "example.com");
      assert.equal(parsed.protocol, "https:");
    });

    it("rejects non-HTTP protocols", async () => {
      await assert.rejects(
        () => validateSafeUrl("file:///etc/passwd", mockPublicLookup),
        /Giao thức không được hỗ trợ/,
      );
      await assert.rejects(
        () => validateSafeUrl("ftp://ftp.example.com", mockPublicLookup),
        /Giao thức không được hỗ trợ/,
      );
      await assert.rejects(
        () => validateSafeUrl("data:text/html,hello", mockPublicLookup),
        /Giao thức không được hỗ trợ/,
      );
    });

    it("rejects localhost and .local domains directly", async () => {
      await assert.rejects(
        () => validateSafeUrl("http://localhost:3000/api", mockPublicLookup),
        /Không được phép truy cập mạng nội bộ/,
      );
      await assert.rejects(
        () => validateSafeUrl("http://myservice.local/test", mockPublicLookup),
        /Không được phép truy cập mạng nội bộ/,
      );
    });

    it("rejects direct private IPs in URL", async () => {
      await assert.rejects(
        () => validateSafeUrl("http://127.0.0.1:8080", mockPublicLookup),
        /Không được phép truy cập dải địa chỉ IP nội bộ/,
      );
      await assert.rejects(
        () => validateSafeUrl("http://169.254.169.254/latest/meta-data", mockPublicLookup),
        /Không được phép truy cập dải địa chỉ IP nội bộ/,
      );
      await assert.rejects(
        () => validateSafeUrl("http://[::1]:8080", mockPublicLookup),
        /Không được phép truy cập dải địa chỉ IPv6 nội bộ/,
      );
    });

    it("rejects domain that resolves to private IP", async () => {
      await assert.rejects(
        () => validateSafeUrl("https://internal.company.corp", mockPrivateLookup),
        /trỏ về địa chỉ nội bộ/,
      );
    });

    it("rejects domain that resolves to cloud metadata IP", async () => {
      await assert.rejects(
        () => validateSafeUrl("https://evil-metadata.com", mockCloudMetadataLookup),
        /trỏ về địa chỉ nội bộ/,
      );
    });
  });
});
