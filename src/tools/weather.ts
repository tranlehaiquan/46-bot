import { tool } from "ai";
import { z } from "zod";

export interface CurrentWeatherInfo {
  temperature: string;
  feelsLike: string;
  condition: string;
  humidity: string;
  wind: string;
  precipitation: string;
  uvIndex: string;
}

export interface DailyForecastInfo {
  date: string;
  maxTemp: string;
  minTemp: string;
  condition: string;
  chanceOfRain?: string;
}

export interface WeatherResult {
  success: boolean;
  location?: string;
  current?: CurrentWeatherInfo;
  forecast?: DailyForecastInfo[];
  message?: string;
}

/**
 * Creates the weather checking tool powered by wttr.in JSON API.
 * Free, real-time, supports global and Vietnamese locations without an API key.
 */
export function createWeatherTool(fetchFn: typeof fetch = fetch) {
  const weather_check = tool({
    description:
      "Tra cứu thông tin thời tiết thời gian thực và dự báo thời tiết cho một địa điểm, tỉnh thành hoặc quốc gia (ví dụ: 'Hà Nội', 'Đà Lạt', 'TP Hồ Chí Minh', 'Đà Nẵng', 'Tokyo', 'Paris').",
    inputSchema: z.object({
      location: z
        .string()
        .describe("Tên địa điểm, thành phố hoặc tỉnh thành cần tra cứu thời tiết"),
      days: z
        .number()
        .int()
        .min(1)
        .max(3)
        .default(1)
        .optional()
        .describe("Số ngày dự báo cần lấy (1-3 ngày, mặc định 1)"),
    }),
    execute: async ({ location, days = 1 }): Promise<WeatherResult> => {
      const cleanLocation = location.trim().replace(/\s+/g, "+");
      const url = `https://wttr.in/${encodeURIComponent(cleanLocation)}?format=j1`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetchFn(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "FamilyBot/1.0",
          },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          return {
            success: false,
            message: `Không thể lấy dữ liệu thời tiết cho "${location}" (Mã lỗi: ${response.status}).`,
          };
        }

        const data = (await response.json()) as any;

        const currentCondition = data.current_condition?.[0];
        if (!currentCondition) {
          return {
            success: false,
            message: `Không tìm thấy thông tin thời tiết cho địa điểm "${location}".`,
          };
        }

        const nearestArea = data.nearest_area?.[0];
        const areaName =
          nearestArea?.areaName?.[0]?.value ||
          nearestArea?.region?.[0]?.value ||
          location;
        const country = nearestArea?.country?.[0]?.value;
        const resolvedLocation = country ? `${areaName}, ${country}` : areaName;

        const current: CurrentWeatherInfo = {
          temperature: `${currentCondition.temp_C}°C`,
          feelsLike: `${currentCondition.FeelsLikeC}°C`,
          condition: currentCondition.weatherDesc?.[0]?.value || "Không rõ",
          humidity: `${currentCondition.humidity}%`,
          wind: `${currentCondition.windspeedKmph} km/h ${currentCondition.winddir16Point || ""}`.trim(),
          precipitation: `${currentCondition.precipMM} mm`,
          uvIndex: currentCondition.uvIndex || "0",
        };

        const forecastList: DailyForecastInfo[] = [];
        if (Array.isArray(data.weather)) {
          const maxDays = Math.min(days, data.weather.length);
          for (let i = 0; i < maxDays; i++) {
            const day = data.weather[i];
            const hourlyNoon = day.hourly?.[4] || day.hourly?.[0]; // ~12:00 or first available
            forecastList.push({
              date: day.date,
              maxTemp: `${day.maxtempC}°C`,
              minTemp: `${day.mintempC}°C`,
              condition: hourlyNoon?.weatherDesc?.[0]?.value || "Không rõ",
              chanceOfRain: hourlyNoon?.chanceofrain
                ? `${hourlyNoon.chanceofrain}%`
                : undefined,
            });
          }
        }

        return {
          success: true,
          location: resolvedLocation,
          current,
          forecast: forecastList.length > 0 ? forecastList : undefined,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message: `Lỗi khi kết nối dịch vụ thời tiết cho "${location}": ${errorMsg}`,
        };
      }
    },
  });

  return { weather_check };
}
