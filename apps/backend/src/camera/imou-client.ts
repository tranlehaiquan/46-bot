import crypto from "node:crypto";

export class ImouApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`Imou API error [${code}]: ${message}`);
    this.name = "ImouApiError";
    this.code = code;
  }
}

export type ImouClientConfig = {
  appId: string;
  appSecret: string;
  baseUrl?: string;
  timeoutMs?: number;
};

export type ImouSnapshotResult = {
  url: string;
  buffer: Buffer;
  timestamp: number;
};

export function generateImouSign(time: number, nonce: string, appSecret: string): string {
  const raw = `time:${time},nonce:${nonce},appSecret:${appSecret}`;
  return crypto.createHash("md5").update(raw, "utf8").digest("hex");
}

export class ImouClient {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: ImouClientConfig) {
    if (!config.appId) {
      throw new Error("Imou appId is required");
    }
    if (!config.appSecret) {
      throw new Error("Imou appSecret is required");
    }
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.baseUrl = (config.baseUrl || "https://openapi.easy4ip.com/openapi").replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? 15000;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getAppId(): string {
    return this.appId;
  }

  /**
   * Clears the in-memory access token cache.
   */
  clearTokenCache(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Internal wrapper to sign and dispatch JSON POST requests to Imou OpenAPI.
   */
  private async callApi<T = unknown>(
    endpoint: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const time = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const sign = generateImouSign(time, nonce, this.appSecret);

    const body = {
      system: {
        ver: "1.0",
        appId: this.appId,
        sign,
        time,
        nonce,
      },
      id: crypto.randomUUID(),
      params,
    };

    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new Error(
        isAbort
          ? `Imou API request timed out after ${this.timeoutMs}ms for ${cleanEndpoint}`
          : `Network error calling Imou API ${cleanEndpoint}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`Imou API HTTP error ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as {
      code?: string | number;
      msg?: string;
      data?: T;
      result?: { code?: string | number; msg?: string; data?: T };
    };

    // Imou response can wrap data under root or under result
    const code = String(json.result?.code ?? json.code ?? "");
    const msg = json.result?.msg ?? json.msg ?? "Unknown error";
    const data = (json.result?.data ?? json.data) as T;

    if (code !== "0") {
      throw new ImouApiError(code, msg);
    }

    return data;
  }

  /**
   * Retrieves an access token, utilizing cached token if still valid.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now) {
      return this.cachedToken;
    }

    const data = await this.callApi<{ accessToken: string; expireTime: number }>(
      "accessToken",
      {},
    );

    if (!data || !data.accessToken) {
      throw new Error("Imou API returned empty accessToken");
    }

    this.cachedToken = data.accessToken;
    // Expire 60 seconds earlier than reported to be safe
    const safetyBufferMs = 60 * 1000;
    const ttlMs = (data.expireTime ?? 3600) * 1000;
    this.tokenExpiresAt = now + Math.max(0, ttlMs - safetyBufferMs);

    return this.cachedToken;
  }

  /**
   * Captures a live snapshot from the specified camera device and channel.
   * Automatically attempts `setDeviceSnapEnhanced` first, then falls back to `setDeviceSnap`.
   */
  async captureDeviceSnapshot(
    deviceId: string,
    channelId = "0",
  ): Promise<ImouSnapshotResult> {
    const token = await this.getAccessToken();

    let imageUrl: string | undefined;

    // 1. Try setDeviceSnapEnhanced first
    try {
      const enhancedData = await this.callApi<{ url?: string; tempUrl?: string }>(
        "setDeviceSnapEnhanced",
        {
          token,
          deviceId,
          channelId,
        },
      );
      imageUrl = enhancedData?.url || enhancedData?.tempUrl;
    } catch (enhancedError) {
      // Fallback to standard setDeviceSnap
      try {
        const standardData = await this.callApi<{ url?: string; tempUrl?: string }>(
          "setDeviceSnap",
          {
            token,
            deviceId,
            channelId,
          },
        );
        imageUrl = standardData?.url || standardData?.tempUrl;
      } catch (standardError) {
        const detail =
          standardError instanceof Error ? standardError.message : String(standardError);
        throw new Error(
          `Không thể chụp ảnh từ camera ${deviceId} (kênh ${channelId}): ${detail}`,
        );
      }
    }

    if (!imageUrl) {
      throw new Error(
        `Không nhận được đường dẫn ảnh từ camera ${deviceId} (kênh ${channelId})`,
      );
    }

    // 2. Download snapshot image buffer
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let imgRes: Response;
    try {
      imgRes = await fetch(imageUrl, {
        headers: { Accept: "image/*" },
        signal: controller.signal,
      });
    } catch (err) {
      throw new Error(
        `Không thể tải ảnh chụp từ Imou Cloud (${imageUrl}): ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!imgRes.ok) {
      throw new Error(`Tải ảnh chụp thất bại với mã lỗi HTTP ${imgRes.status}`);
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      url: imageUrl,
      buffer,
      timestamp: Date.now(),
    };
  }

  /**
   * Verifies credentials against the Imou Open Platform by fetching an access token.
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    tokenPreview?: string;
  }> {
    try {
      this.clearTokenCache();
      const token = await this.getAccessToken();
      const preview =
        token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : "***";
      return {
        success: true,
        message: "Kết nối thành công tới Imou Cloud Open API",
        tokenPreview: preview,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message,
      };
    }
  }
}
