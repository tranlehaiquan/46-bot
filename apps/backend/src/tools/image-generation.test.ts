import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createImageGenerateTool } from "./image-generation.js";
import type { AppConfig } from "../config.js";
import type { SettingsRepository } from "../db/repositories/settings.js";

function mockConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    zaloBotToken: "test-token",
    familyChatId: "chat-1",
    familyChatIds: ["chat-1"],
    webhookUrl: "https://example.com/webhook",
    webhookSecret: "secret12345",
    mode: "webhook",
    port: 3000,
    dbPath: ":memory:",
    botId: "bot-1",
    adminPassword: "pass",
    llmProvider: "gemini",
    llmApiKey: "test-gemini-key",
    llmModel: "gemini-3.8-flash",
    geminiApiKey: "test-gemini-key",
    geminiModel: "gemini-3.8-flash",
    geminiImageModel: "gemini-3.1-flash-image",
    deepseekModel: "deepseek-chat",
    ziplineUrl: "https://zipline.example.com",
    ziplineToken: "zip-token-123",
    passiveMemoryEnabled: true,
    ...overrides,
  };
}

describe("AI Image Generation Tool (image_generate)", () => {
  it("returns error when geminiApiKey is missing", async () => {
    const config = mockConfig({ geminiApiKey: undefined });
    const toolGroup = createImageGenerateTool({
      chatId: "chat-1",
      config,
    });

    const result = await (toolGroup.image_generate as any).execute({
      prompt: "vẽ một chú mèo",
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Chưa cấu hình Gemini API Key/);
  });

  it("returns error when zipline is not configured", async () => {
    const config = mockConfig({ ziplineUrl: undefined, ziplineToken: undefined });
    const toolGroup = createImageGenerateTool({
      chatId: "chat-1",
      config,
    });

    const result = await (toolGroup.image_generate as any).execute({
      prompt: "vẽ cảnh hoàng hôn",
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Chưa cấu hình Zipline URL hoặc API token/);
  });

  it("handles model image generation failure gracefully", async () => {
    const config = mockConfig();
    const mockGenerateImage = async () => {
      throw new Error("Content safety policy violation");
    };

    const toolGroup = createImageGenerateTool({
      chatId: "chat-1",
      config,
      generateImageFn: mockGenerateImage as any,
    });

    const result = await (toolGroup.image_generate as any).execute({
      prompt: "hình ảnh bị cấm",
    });

    assert.equal(result.success, false);
    assert.match(result.message, /Không thể tạo hình ảnh lúc này/);
    assert.match(result.message, /Content safety policy violation/);
  });

  it("successfully generates image, uploads to zipline, and dispatches photo via zalo.sendPhoto", async () => {
    const config = mockConfig();
    const fakeImageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header bytes

    let generatedModelId = "";
    let generatedPrompt = "";
    let generatedAspect = "";

    const mockGenerateImage = async (opts: any) => {
      generatedModelId = opts.model.modelId;
      generatedPrompt = opts.prompt;
      generatedAspect = opts.aspectRatio;
      return {
        image: {
          uint8Array: fakeImageData,
          base64: Buffer.from(fakeImageData).toString("base64"),
          mediaType: "image/png",
        },
        images: [
          {
            uint8Array: fakeImageData,
            base64: Buffer.from(fakeImageData).toString("base64"),
            mediaType: "image/png",
          },
        ],
      };
    };

    let uploadedFilename = "";
    let uploadedToken = "";
    const mockUploadZipline = async (opts: any) => {
      uploadedFilename = opts.filename;
      uploadedToken = opts.token;
      return { url: "https://zipline.example.com/u/cat_123.png" };
    };

    const sentPhotos: Array<{ chatId: string; photo: string; caption?: string }> = [];
    const mockZalo = {
      sendPhoto: async (chatId: string, photo: string, caption?: string) => {
        sentPhotos.push({ chatId, photo, caption });
      },
    };

    const toolGroup = createImageGenerateTool({
      chatId: "chat-room-42",
      config,
      zalo: mockZalo as any,
      generateImageFn: mockGenerateImage as any,
      uploadToZiplineFn: mockUploadZipline as any,
    });

    const result = await (toolGroup.image_generate as any).execute({
      prompt: "chú mèo lông vàng dễ thương",
      aspectRatio: "16:9",
      caption: "Ảnh mèo con",
    });

    assert.equal(result.success, true);
    assert.equal(result.url, "https://zipline.example.com/u/cat_123.png");
    assert.match(result.message, /Đã vẽ và gửi thành công/);

    assert.equal(generatedModelId, "gemini-3.1-flash-image");
    assert.equal(generatedPrompt, "chú mèo lông vàng dễ thương");
    assert.equal(generatedAspect, "16:9");

    assert.ok(uploadedFilename.startsWith("ai_gen_"));
    assert.equal(uploadedToken, "zip-token-123");

    assert.equal(sentPhotos.length, 1);
    assert.equal(sentPhotos[0].chatId, "chat-room-42");
    assert.equal(sentPhotos[0].photo, "https://zipline.example.com/u/cat_123.png");
    assert.equal(sentPhotos[0].caption, "Ảnh mèo con");
  });

  it("handles zipline upload error gracefully", async () => {
    const config = mockConfig();
    const fakeImageData = new Uint8Array([1, 2, 3]);

    const mockGenerateImage = async () => ({
      image: { uint8Array: fakeImageData },
    });

    const mockUploadZipline = async () => {
      throw new Error("Disk quota exceeded on Zipline");
    };

    const toolGroup = createImageGenerateTool({
      chatId: "chat-1",
      config,
      generateImageFn: mockGenerateImage as any,
      uploadToZiplineFn: mockUploadZipline as any,
    });

    const result = await (toolGroup.image_generate as any).execute({
      prompt: "phong cảnh rừng cây",
    });

    assert.equal(result.success, false);
    assert.match(result.message, /tải lên Zipline thất bại/);
    assert.match(result.message, /Disk quota exceeded/);
  });

  it("uses custom gemini_image_model from settings repository over default", async () => {
    const config = mockConfig();
    const fakeImageData = new Uint8Array([1, 2, 3]);

    let invokedModelId = "";
    const mockGenerateImage = async (opts: any) => {
      invokedModelId = opts.model.modelId;
      return {
        image: { uint8Array: fakeImageData },
      };
    };

    const mockSettingsRepo: SettingsRepository = {
      get: async (key: string) => (key === "gemini_image_model" ? "gemini-3-pro-image" : null),
      set: async () => {},
      delete: async () => {},
      getAll: async () => ({ gemini_image_model: "gemini-3-pro-image" }),
      setMany: async () => {},
    };

    const toolGroup = createImageGenerateTool({
      chatId: "chat-1",
      config,
      settingsRepo: mockSettingsRepo,
      generateImageFn: mockGenerateImage as any,
      uploadToZiplineFn: (async () => ({ url: "https://zipline.example.com/test.png" })) as any,
    });

    await (toolGroup.image_generate as any).execute({
      prompt: "bầu trời xanh",
    });

    assert.equal(invokedModelId, "gemini-3-pro-image");
  });
});
