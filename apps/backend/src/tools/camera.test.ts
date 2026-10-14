import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  findMatchingCamera,
  createCameraTools,
} from "./camera.js";
import type { CameraConfig } from "../config.js";
import { ImouClient } from "../camera/imou-client.js";

describe("Camera tools", () => {
  const sampleCameras: CameraConfig[] = [
    {
      id: "phong_khach",
      name: "Phòng khách",
      deviceId: "DEV_PK_12345",
      channelId: "0",
    },
    {
      id: "cua_chinh",
      name: "Cửa chính",
      deviceId: "DEV_CC_67890",
      channelId: "0",
    },
  ];

  describe("findMatchingCamera", () => {
    it("returns undefined if cameras list is empty", () => {
      assert.equal(findMatchingCamera("phong_khach", []), undefined);
    });

    it("returns first camera if query is empty or undefined", () => {
      assert.equal(findMatchingCamera(undefined, sampleCameras), sampleCameras[0]);
      assert.equal(findMatchingCamera("", sampleCameras), sampleCameras[0]);
    });

    it("matches camera by exact id or exact name", () => {
      assert.equal(findMatchingCamera("phong_khach", sampleCameras)?.id, "phong_khach");
      assert.equal(findMatchingCamera("Cửa chính", sampleCameras)?.id, "cua_chinh");
    });

    it("matches camera case-insensitively and diacritic-insensitively", () => {
      assert.equal(findMatchingCamera("phong khach", sampleCameras)?.id, "phong_khach");
      assert.equal(findMatchingCamera("cua chinh", sampleCameras)?.id, "cua_chinh");
      assert.equal(findMatchingCamera("PHÒNG KHÁCH", sampleCameras)?.id, "phong_khach");
    });

    it("falls back to first camera if query does not match any camera", () => {
      assert.equal(findMatchingCamera("san_thuong", sampleCameras)?.id, "phong_khach");
    });
  });

  describe("tool execution", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "camera-test-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("camera_list returns available cameras", async () => {
      const dummyClient = new ImouClient({ appId: "test", appSecret: "test" });
      const tools = createCameraTools({
        chatId: "chat-1",
        senderName: "User 1",
        client: dummyClient,
        cameras: sampleCameras,
        outputDir: tempDir,
      });

      const result = (await tools.camera_list.execute!({}, {} as any)) as any;
      assert.equal(result.success, true);
      assert.equal(result.total, 2);
      assert.equal(result.cameras.length, 2);
      assert.equal(result.cameras[0].id, "phong_khach");
      assert.equal(result.cameras[0].name, "Phòng khách");
      assert.match(result.cameras[0].deviceId, /DEV_\*\*\*/);
    });

    it("camera_capture takes snapshot, writes file, and sends photo via Zalo client", async () => {
      const dummyClient = new ImouClient({ appId: "test", appSecret: "test" });
      const sampleBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]);

      // Mock captureDeviceSnapshot
      dummyClient.captureDeviceSnapshot = async (deviceId: string, channelId?: string) => {
        assert.equal(deviceId, "DEV_PK_12345");
        assert.equal(channelId, "0");
        return {
          url: "https://imou.example/snap.jpg",
          buffer: sampleBuffer,
          timestamp: 1728900000000,
        };
      };

      const photosSent: Array<{ chatId: string; photo: string; caption?: string }> = [];
      const mockZalo = {
        async getWebhookInfo() { return { url: "" }; },
        async setWebhook() { return { outcome: "ok" }; },
        async testWebhook() { return { outcome: "ok" }; },
        async sendMessage() {},
        async sendPhoto(chatId: string, photo: string, caption?: string) {
          photosSent.push({ chatId, photo, caption });
        },
      };

      const tools = createCameraTools({
        chatId: "chat-family-1",
        senderName: "Quan",
        client: dummyClient,
        cameras: sampleCameras,
        zalo: mockZalo,
        publicBaseUrl: "https://my-bot.example",
        outputDir: tempDir,
      });

      const result = (await tools.camera_capture.execute!(
        { camera: "phong_khach", sendPhoto: true },
        {} as any,
      )) as any;

      assert.equal(result.success, true);
      assert.equal(result.cameraId, "phong_khach");
      assert.equal(result.photoSent, true);
      assert.match(result.photoUrl, /^https:\/\/my-bot\.example\/images\/camera\/snap_phong_khach_\d+\.jpg$/);

      // Verify file written to outputDir
      const savedFiles = fs.readdirSync(tempDir);
      assert.equal(savedFiles.length, 1);
      assert.deepEqual(fs.readFileSync(path.join(tempDir, savedFiles[0])), sampleBuffer);

      // Verify photo sent via Zalo
      assert.equal(photosSent.length, 1);
      assert.equal(photosSent[0].chatId, "chat-family-1");
      assert.equal(photosSent[0].photo, result.photoUrl);
      assert.match(photosSent[0].caption || "", /Ảnh chụp từ camera Phòng khách/);
    });

    it("camera_capture handles capture failures gracefully without crashing", async () => {
      const dummyClient = new ImouClient({ appId: "test", appSecret: "test" });
      dummyClient.captureDeviceSnapshot = async () => {
        throw new Error("Device offline");
      };

      const tools = createCameraTools({
        chatId: "chat-1",
        senderName: "User",
        client: dummyClient,
        cameras: sampleCameras,
        outputDir: tempDir,
      });

      const result = (await tools.camera_capture.execute!(
        { camera: "cua_chinh" },
        {} as any,
      )) as any;

      assert.equal(result.success, false);
      assert.match(result.message, /Device offline/);
    });
  });
});
