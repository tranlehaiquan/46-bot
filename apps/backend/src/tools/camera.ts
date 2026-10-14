import fs from "node:fs";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import type { CameraConfig } from "../config.js";
import type { ImouClient } from "../camera/imou-client.js";
import type { ZaloClient } from "../zalo-client.js";
import { removeVietnameseDiacritics } from "./memory-search.js";

export type CameraToolsContext = {
  chatId: string;
  senderName: string;
  client: ImouClient;
  cameras: CameraConfig[];
  zalo?: ZaloClient;
  publicBaseUrl?: string;
  outputDir: string;
  geminiApiKey?: string;
  geminiModel?: string;
};

export function findMatchingCamera(
  query: string | undefined,
  cameras: CameraConfig[],
): CameraConfig | undefined {
  if (cameras.length === 0) return undefined;
  if (!query || query.trim() === "") return cameras[0];

  const q = query.trim().toLowerCase();
  const qNorm = removeVietnameseDiacritics(q);

  // 1. Exact ID match
  const byId = cameras.find((c) => c.id.toLowerCase() === q);
  if (byId) return byId;

  // 2. Exact Name match
  const byName = cameras.find((c) => c.name.toLowerCase() === q);
  if (byName) return byName;

  // 3. Substring match (normalized)
  const bySub = cameras.find((c) => {
    const nameNorm = removeVietnameseDiacritics(c.name.toLowerCase());
    const idNorm = removeVietnameseDiacritics(c.id.toLowerCase());
    return (
      nameNorm.includes(qNorm) ||
      qNorm.includes(nameNorm) ||
      idNorm.includes(qNorm)
    );
  });
  if (bySub) return bySub;

  // Default to first camera
  return cameras[0];
}

export async function inspectSnapshotWithGemini(options: {
  apiKey: string;
  modelName?: string;
  image: Buffer;
  question: string;
  cameraName: string;
}): Promise<string> {
  const google = createGoogleGenerativeAI({ apiKey: options.apiKey });
  const model = google(options.modelName || "gemini-3.8-flash");

  const prompt = `Bạn là trợ lý camera an ninh gia đình thông minh.
Dưới đây là hình ảnh trực tiếp vừa được chụp từ camera "${options.cameraName}".
Hãy quan sát kỹ từng chi tiết trong hình ảnh và trả lời câu hỏi sau của người dùng một cách chính xác, trung thực, ngắn gọn và hữu ích:

Câu hỏi: "${options.question}"

Lưu ý:
- Nếu quan sát thấy rõ đối tượng/hành động được hỏi, hãy mô tả cụ thể (vị trí, trạng thái, màu sắc...).
- Nếu hình ảnh bị tối, che khuất hoặc không thấy rõ chi tiết được hỏi, hãy nói thật là không quan sát thấy rõ thay vì phỏng đoán bừa bãi.`;

  const result = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "file",
            data: options.image,
            mediaType: "image/jpeg",
          },
        ],
      },
    ],
  });

  return result.text.trim();
}

export function createCameraTools(context: CameraToolsContext) {
  const {
    chatId,
    client,
    cameras,
    zalo,
    publicBaseUrl,
    outputDir,
    geminiApiKey,
    geminiModel,
  } = context;

  const camera_list = tool({
    description:
      "Xem danh sách tất cả các camera an ninh đang được kết nối trong gia đình (tên camera, vị trí, ID).",
    inputSchema: z.object({}),
    execute: async () => {
      if (cameras.length === 0) {
        return {
          success: false,
          total: 0,
          cameras: [],
          message: "Chưa có camera nào được cấu hình trong hệ thống.",
        };
      }

      return {
        success: true,
        total: cameras.length,
        cameras: cameras.map((c) => ({
          id: c.id,
          name: c.name,
          deviceId: `${c.deviceId.slice(0, 4)}***`,
          channelId: c.channelId,
        })),
        message: `Đang có ${cameras.length} camera: ${cameras.map((c) => `${c.name} (${c.id})`).join(", ")}.`,
      };
    },
  });

  const camera_capture = tool({
    description:
      "Chụp ảnh trực tiếp từ camera an ninh (ví dụ: phòng khách, cửa chính, sân trước...), gửi hình ảnh vào nhóm chat Zalo và có thể phân tích/quan sát hình ảnh bằng AI Vision để trả lời câu hỏi của người dùng (ví dụ: 'có ai ở nhà không', 'bé đã ngủ chưa', 'cửa đã đóng chưa').",
    inputSchema: z.object({
      camera: z
        .string()
        .optional()
        .describe(
          "Tên hoặc ID của camera cần chụp (ví dụ: 'phong_khach', 'phòng khách', 'cửa chính', 'sân trước'). Nếu không truyền sẽ tự động chọn camera phù hợp nhất hoặc camera mặc định.",
        ),
      sendPhoto: z
        .boolean()
        .optional()
        .describe(
          "Có gửi trực tiếp hình ảnh vừa chụp vào nhóm chat Zalo hay không (mặc định là true).",
        ),
      caption: z
        .string()
        .optional()
        .describe("Nội dung lời chú thích kèm theo ảnh gửi vào nhóm chat."),
      question: z
        .string()
        .optional()
        .describe(
          "Câu hỏi quan sát hoặc kiểm tra cần AI Vision phân tích từ ảnh chụp (ví dụ: 'Có ai trong phòng khách không?', 'Bé đã ngủ chưa?', 'Cửa cổng đang đóng hay mở?').",
        ),
    }),
    execute: async (input) => {
      if (cameras.length === 0) {
        return {
          success: false,
          message:
            "Chưa có camera nào được cấu hình. Vui lòng cấu hình IMOU_CAMERAS hoặc IMOU_DEVICE_ID trong phần Cài đặt quản trị.",
        };
      }

      const targetCamera = findMatchingCamera(input.camera, cameras);
      if (!targetCamera) {
        return {
          success: false,
          message: `Không tìm thấy camera phù hợp với yêu cầu "${input.camera}". Các camera hiện có: ${cameras.map((c) => c.name).join(", ")}.`,
        };
      }

      try {
        // 1. Capture snapshot from Imou Cloud
        const snap = await client.captureDeviceSnapshot(
          targetCamera.deviceId,
          targetCamera.channelId,
        );

        // 2. Save snapshot locally for serving
        fs.mkdirSync(outputDir, { recursive: true });
        const safeCameraId = targetCamera.id.replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `snap_${safeCameraId}_${Date.now()}.jpg`;
        const localPath = path.join(outputDir, filename);
        fs.writeFileSync(localPath, snap.buffer);

        // 3. Construct public URL
        const baseUrl = publicBaseUrl ? publicBaseUrl.replace(/\/+$/, "") : "";
        const photoUrl = baseUrl
          ? `${baseUrl}/images/camera/${filename}`
          : `/images/camera/${filename}`;

        // 4. Send photo to Zalo chat if requested
        let photoSent = false;
        let photoSendError: string | undefined;

        if (input.sendPhoto !== false) {
          if (!baseUrl) {
            photoSendError =
              "Chưa cấu hình URL công khai (WEBHOOK_URL) nên không thể gửi ảnh vào Zalo.";
          } else if (zalo && typeof zalo.sendPhoto === "function") {
            try {
              const nowStr = new Intl.DateTimeFormat("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }).format(new Date(snap.timestamp));

              const finalCaption =
                input.caption ||
                `📷 Ảnh chụp từ camera ${targetCamera.name} (${nowStr})`;
              await zalo.sendPhoto(chatId, photoUrl, finalCaption);
              photoSent = true;
            } catch (err) {
              photoSendError =
                err instanceof Error ? err.message : String(err);
            }
          }
        }

        // 5. AI Vision analysis if question provided
        let visualAnalysis: string | undefined;
        let visionError: string | undefined;

        if (input.question && input.question.trim().length > 0) {
          if (geminiApiKey) {
            try {
              visualAnalysis = await inspectSnapshotWithGemini({
                apiKey: geminiApiKey,
                modelName: geminiModel,
                image: snap.buffer,
                question: input.question.trim(),
                cameraName: targetCamera.name,
              });
            } catch (vErr) {
              visionError =
                vErr instanceof Error ? vErr.message : String(vErr);
            }
          } else {
            visualAnalysis =
              "Không thể phân tích hình ảnh vì chưa cấu hình Gemini API Key.";
          }
        }

        const message = photoSent
          ? `Đã chụp và gửi thành công ảnh camera ${targetCamera.name} vào nhóm chat.`
          : `Đã chụp ảnh camera ${targetCamera.name} thành công (${photoSendError ? `Lưu ý gửi ảnh: ${photoSendError}` : "Không yêu cầu gửi ảnh vào chat"}).`;

        return {
          success: true,
          cameraId: targetCamera.id,
          cameraName: targetCamera.name,
          photoUrl,
          photoSent,
          photoSendError,
          visualAnalysis,
          visionError,
          message,
        };
      } catch (err) {
        const errorDetail = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          cameraId: targetCamera.id,
          cameraName: targetCamera.name,
          message: `Lỗi khi chụp ảnh từ camera ${targetCamera.name}: ${errorDetail}`,
        };
      }
    },
  });

  return {
    camera_list,
    camera_capture,
  };
}
