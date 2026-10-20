import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateImage, tool } from "ai";
import { z } from "zod";
import { resolveEffectiveSettings } from "../admin/settings-helper.js";
import type { AppConfig } from "../config.js";
import type { SettingsRepository } from "../db/repositories/settings.js";
import { uploadImageToZipline } from "../storage/zipline.js";
import type { ZaloClient } from "../zalo-client.js";

export interface ImageGenerateContext {
  chatId: string;
  config: AppConfig;
  settingsRepo?: SettingsRepository;
  zalo?: ZaloClient;
  generateImageFn?: typeof generateImage;
  uploadToZiplineFn?: typeof uploadImageToZipline;
}

export function createImageGenerateTool(context: ImageGenerateContext) {
  return {
    image_generate: tool({
      description:
        "Tạo hình ảnh AI (Text-to-Image) bằng Google Imagen khi người dùng yêu cầu vẽ tranh, minh họa, hoặc tạo hình ảnh. Hình ảnh sẽ được tự động tạo, tải lên lưu trữ và gửi trực tiếp vào nhóm chat.",
      inputSchema: z.object({
        prompt: z
          .string()
          .describe("Mô tả chi tiết hình ảnh cần tạo bằng tiếng Việt hoặc tiếng Anh"),
        aspectRatio: z
          .enum(["1:1", "3:4", "4:3", "9:16", "16:9"])
          .optional()
          .describe("Tỷ lệ khung hình mong muốn (ví dụ 1:1 hình vuông, 16:9 ngang, 9:16 dọc)"),
        caption: z
          .string()
          .optional()
          .describe("Chú thích ngắn gọn gửi kèm theo ảnh trên Zalo"),
      }),
      execute: async ({ prompt, aspectRatio, caption }) => {
        const { config, settingsRepo, zalo, chatId } = context;

        // 1. Resolve effective settings from DB & config
        const resolved = settingsRepo
          ? await resolveEffectiveSettings(settingsRepo, config)
          : null;

        const geminiApiKey = resolved?.effective.geminiApiKey || config.geminiApiKey;
        const geminiImageModel =
          resolved?.effective.geminiImageModel ||
          config.geminiImageModel ||
          "imagen-3.0-generate-002";
        const ziplineUrl = resolved?.effective.ziplineUrl || config.ziplineUrl;
        const ziplineToken = resolved?.effective.ziplineToken || config.ziplineToken;

        // 2. Validate prerequisites
        if (!geminiApiKey || geminiApiKey.trim() === "") {
          return {
            success: false,
            message:
              "Chưa cấu hình Gemini API Key. Vui lòng cấu hình khóa API trong Admin Settings để sử dụng tính năng tạo hình ảnh.",
          };
        }

        if (!ziplineUrl || !ziplineToken || ziplineUrl.trim() === "" || ziplineToken.trim() === "") {
          return {
            success: false,
            message:
              "Chưa cấu hình Zipline URL hoặc API token trong Admin Settings. Cần có Zipline để lưu trữ và hiển thị ảnh trong nhóm Zalo.",
          };
        }

        // 3. Generate image using Gemini Imagen
        const generateFn = context.generateImageFn ?? generateImage;
        const uploadFn = context.uploadToZiplineFn ?? uploadImageToZipline;

        let imageBuffer: Buffer;
        try {
          const google = createGoogleGenerativeAI({ apiKey: geminiApiKey });
          const model = google.imageModel(geminiImageModel);

          const result = await generateFn({
            model,
            prompt,
            aspectRatio: aspectRatio ?? "1:1",
          });

          const generated = result.image ?? result.images?.[0];
          if (!generated) {
            return {
              success: false,
              message: "Không nhận được dữ liệu hình ảnh từ mô hình tạo ảnh.",
            };
          }

          imageBuffer = Buffer.from(generated.uint8Array);
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            message: `Không thể tạo hình ảnh lúc này (${errMsg}). Bạn hãy thử lại với mô tả khác nhé.`,
          };
        }

        // 4. Upload image to Zipline
        let photoUrl: string;
        try {
          const uploadRes = await uploadFn({
            buffer: imageBuffer,
            filename: `ai_gen_${Date.now()}.png`,
            mimeType: "image/png",
            url: ziplineUrl,
            token: ziplineToken,
          });
          photoUrl = uploadRes.url;
        } catch (err: any) {
          const uploadError = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            message: `Đã tạo được hình ảnh nhưng tải lên Zipline thất bại: ${uploadError}`,
          };
        }

        // 5. Send photo to Zalo chat
        const finalCaption = caption ?? prompt;
        let sentToChannel = false;
        let sendError: string | undefined;

        if (zalo && typeof zalo.sendPhoto === "function") {
          try {
            await zalo.sendPhoto(chatId, photoUrl, finalCaption);
            sentToChannel = true;
          } catch (err: any) {
            sendError = err instanceof Error ? err.message : String(err);
          }
        } else {
          sendError = "Không tìm thấy client Zalo hỗ trợ gửi ảnh.";
        }

        if (sentToChannel) {
          return {
            success: true,
            url: photoUrl,
            message: `Đã vẽ và gửi thành công hình ảnh vào nhóm: "${finalCaption}"`,
          };
        }

        return {
          success: true,
          url: photoUrl,
          message: `Đã tạo hình ảnh thành công nhưng không thể gửi vào nhóm qua Zalo (${sendError ?? "Lỗi không xác định"}). Link ảnh: ${photoUrl}`,
        };
      },
    }),
  };
}
