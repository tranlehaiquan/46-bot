export interface UploadImageOptions {
  buffer: Buffer | Uint8Array;
  filename?: string;
  mimeType?: string;
  url?: string;
  token?: string;
  fetchFn?: typeof fetch;
}

export interface ZiplineConnectionTestOptions {
  url: string;
  token: string;
  fetchFn?: typeof fetch;
}

export interface ZiplineConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Normalizes a base URL by trimming whitespace and removing trailing slashes.
 */
export function normalizeZiplineUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  while (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  return url;
}

/**
 * Uploads an image binary buffer to a Zipline instance and returns the public file URL.
 */
export async function uploadImageToZipline(
  options: UploadImageOptions,
): Promise<{ url: string }> {
  const rawUrl = options.url?.trim();
  const rawToken = options.token?.trim();

  if (!rawUrl || !rawToken) {
    throw new Error(
      "Cấu hình Zipline chưa đầy đủ (thiếu URL hoặc API token). Vui lòng cấu hình trong Admin Settings.",
    );
  }

  const baseUrl = normalizeZiplineUrl(rawUrl);
  const uploadEndpoint = `${baseUrl}/api/upload`;
  const filename = options.filename || `image_${Date.now()}.png`;
  const mimeType = options.mimeType || "image/png";

  const fetchFn = options.fetchFn ?? fetch;

  const formData = new FormData();
  const blob = new Blob([options.buffer as any], { type: mimeType });
  formData.append("file", blob, filename);

  const headers: Record<string, string> = {
    authorization: rawToken,
  };

  let response: Response;
  try {
    response = await fetchFn(uploadEndpoint, {
      method: "POST",
      headers,
      body: formData,
      signal: AbortSignal.timeout(30000),
    });
  } catch (err: any) {
    throw new Error(`Lỗi kết nối khi tải ảnh lên Zipline: ${err.message || String(err)}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Zipline upload thất bại (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data.files) && data.files.length > 0) {
      const first = data.files[0];
      if (typeof first === "string" && first.trim()) {
        return { url: first.trim() };
      }
      if (first && typeof first === "object" && typeof first.url === "string") {
        return { url: first.url.trim() };
      }
    }
    if (typeof data.url === "string" && data.url.trim()) {
      return { url: data.url.trim() };
    }
  } catch {
    // Response might be raw URL string if x-zipline-no-json was used or plain text returned
    if (text.startsWith("http://") || text.startsWith("https://")) {
      return { url: text.trim().split(/[\r\n,]/)[0].trim() };
    }
  }

  throw new Error("Không thể trích xuất URL ảnh từ phản hồi của Zipline");
}

/**
 * Tests connectivity and authorization against a Zipline service.
 */
export async function testZiplineConnection(
  options: ZiplineConnectionTestOptions,
): Promise<ZiplineConnectionResult> {
  const { url, token, fetchFn = fetch } = options;

  if (!url || !url.trim() || !token || !token.trim()) {
    return {
      success: false,
      error: "Zipline URL và API token không được để trống",
    };
  }

  const baseUrl = normalizeZiplineUrl(url);

  try {
    // Try GET /api/user first (standard Zipline user inspection endpoint)
    const userRes = await fetchFn(`${baseUrl}/api/user`, {
      method: "GET",
      headers: {
        authorization: token.trim(),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (userRes.ok) {
      return {
        success: true,
        message: "Kết nối Zipline thành công (xác thực token thành công)",
      };
    }

    if (userRes.status === 401 || userRes.status === 403) {
      return {
        success: false,
        error: `Xác thực Zipline thất bại (${userRes.status}): Token không hợp lệ`,
      };
    }

    // If /api/user is 404 or not found, try a preflight/options check on /api/upload
    const uploadCheck = await fetchFn(`${baseUrl}/api/upload`, {
      method: "GET",
      headers: {
        authorization: token.trim(),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (uploadCheck.status === 401 || uploadCheck.status === 403) {
      return {
        success: false,
        error: `Xác thực Zipline thất bại (${uploadCheck.status}): Token không hợp lệ`,
      };
    }

    if (uploadCheck.ok || uploadCheck.status === 405 || uploadCheck.status === 400) {
      return {
        success: true,
        message: "Kết nối Zipline thành công",
      };
    }

    const text = await uploadCheck.text().catch(() => "");
    return {
      success: false,
      error: `Kiểm tra Zipline thất bại (${uploadCheck.status}): ${text || uploadCheck.statusText}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Không thể kết nối đến máy chủ Zipline: ${err.message || String(err)}`,
    };
  }
}
