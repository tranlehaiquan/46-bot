import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWeatherTool } from "./weather.js";

describe("Weather tools", () => {
  it("fetches and parses current weather and forecast successfully", async () => {
    const mockApiResponse = {
      current_condition: [
        {
          temp_C: "24",
          FeelsLikeC: "26",
          weatherDesc: [{ value: "Partly cloudy" }],
          humidity: "75",
          windspeedKmph: "15",
          winddir16Point: "NE",
          precipMM: "0.2",
          uvIndex: "3",
        },
      ],
      nearest_area: [
        {
          areaName: [{ value: "Hanoi" }],
          country: [{ value: "Vietnam" }],
        },
      ],
      weather: [
        {
          date: "2026-10-05",
          maxtempC: "30",
          mintempC: "22",
          hourly: [
            { weatherDesc: [{ value: "Sunny" }], chanceofrain: "10" },
            { weatherDesc: [{ value: "Sunny" }], chanceofrain: "10" },
            { weatherDesc: [{ value: "Sunny" }], chanceofrain: "10" },
            { weatherDesc: [{ value: "Sunny" }], chanceofrain: "10" },
            { weatherDesc: [{ value: "Sunny" }], chanceofrain: "10" },
          ],
        },
        {
          date: "2026-10-06",
          maxtempC: "29",
          mintempC: "21",
          hourly: [
            { weatherDesc: [{ value: "Patchy rain" }], chanceofrain: "65" },
            { weatherDesc: [{ value: "Patchy rain" }], chanceofrain: "65" },
            { weatherDesc: [{ value: "Patchy rain" }], chanceofrain: "65" },
            { weatherDesc: [{ value: "Patchy rain" }], chanceofrain: "65" },
            { weatherDesc: [{ value: "Patchy rain" }], chanceofrain: "65" },
          ],
        },
      ],
    };

    const mockFetch = async (url: string | URL | Request) => {
      assert.ok(String(url).includes("wttr.in/Hanoi"));
      return {
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      } as Response;
    };

    const tools = createWeatherTool(mockFetch as any);
    const result = (await tools.weather_check.execute!(
      { location: "Hanoi", days: 2 },
      {} as any,
    )) as any;

    assert.equal(result.success, true);
    assert.equal(result.location, "Hanoi, Vietnam");
    assert.equal(result.current.temperature, "24°C");
    assert.equal(result.current.feelsLike, "26°C");
    assert.equal(result.current.condition, "Partly cloudy");
    assert.equal(result.current.humidity, "75%");
    assert.equal(result.current.wind, "15 km/h NE");
    assert.equal(result.current.precipitation, "0.2 mm");
    assert.equal(result.current.uvIndex, "3");

    assert.equal(result.forecast.length, 2);
    assert.equal(result.forecast[0].date, "2026-10-05");
    assert.equal(result.forecast[0].maxTemp, "30°C");
    assert.equal(result.forecast[0].minTemp, "22°C");
    assert.equal(result.forecast[0].condition, "Sunny");
    assert.equal(result.forecast[0].chanceOfRain, "10%");
  });

  it("handles HTTP error response gracefully", async () => {
    const mockFetch = async () => {
      return {
        ok: false,
        status: 404,
      } as Response;
    };

    const tools = createWeatherTool(mockFetch as any);
    const result = (await tools.weather_check.execute!(
      { location: "UnknownPlace123" },
      {} as any,
    )) as any;

    assert.equal(result.success, false);
    assert.match(result.message, /Không thể lấy dữ liệu thời tiết/);
  });

  it("handles network failure / exception gracefully", async () => {
    const mockFetch = async () => {
      throw new Error("Connection timeout");
    };

    const tools = createWeatherTool(mockFetch as any);
    const result = (await tools.weather_check.execute!(
      { location: "Da Nang" },
      {} as any,
    )) as any;

    assert.equal(result.success, false);
    assert.match(result.message, /Lỗi khi kết nối dịch vụ thời tiết/);
    assert.match(result.message, /Connection timeout/);
  });
});
