import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrations.js";
import { createEventsRepository } from "../db/repositories/events.js";
import { createEventTools } from "./events.js";

describe("Event tools", () => {
  it("executes event_add, event_list_upcoming, event_update, and event_delete", async () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createEventsRepository(db);
      const tools = createEventTools(repo, { chatId: "chat-events", senderName: "Bố" });

      // 1. event_add (solar birthday)
      const addRes = (await tools.event_add.execute?.(
        {
          title: "Sinh nhật Con gái",
          kind: "birthday",
          calendar: "solar",
          day: 20,
          month: 11,
          isLeapMonth: false,
          recurrence: "yearly",
          remindDaysBefore: 2,
        },
        {} as any,
      )) as any;

      assert.ok(addRes);
      assert.equal(addRes.success, true);
      assert.equal(addRes.event.title, "Sinh nhật Con gái");
      assert.equal(addRes.event.calendar, "solar");
      assert.equal(addRes.event.recurrence, "yearly");
      const eventId = addRes.event.id;

      // 2. event_add (lunar death anniversary / giỗ)
      const addLunarRes = (await tools.event_add.execute?.(
        {
          title: "Giỗ Cụ",
          kind: "gio",
          calendar: "lunar",
          day: 15,
          month: 8,
          isLeapMonth: false,
          recurrence: "yearly",
          remindDaysBefore: 0,
        },
        {} as any,
      )) as any;
      assert.ok(addLunarRes);
      assert.equal(addLunarRes.success, true);
      assert.equal(addLunarRes.event.calendar, "lunar");

      // 3. event_list_upcoming
      const listRes = (await tools.event_list_upcoming.execute?.(
        { windowDays: 365 },
        {} as any,
      )) as any;
      assert.ok(listRes);
      assert.equal(listRes.success, true);
      assert.equal(listRes.total, 2);

      // 4. event_update
      const updateRes = (await tools.event_update.execute?.(
        {
          id: eventId,
          title: "Sinh nhật Con gái yêu",
          remindDaysBefore: 3,
        },
        {} as any,
      )) as any;
      assert.ok(updateRes);
      assert.equal(updateRes.success, true);
      assert.equal(updateRes.event.title, "Sinh nhật Con gái yêu");

      // 5. event_delete
      const deleteRes = (await tools.event_delete.execute?.(
        { id: eventId },
        {} as any,
      )) as any;
      assert.ok(deleteRes);
      assert.equal(deleteRes.success, true);

      // Verify list after delete
      const listAfterDelete = (await tools.event_list_upcoming.execute?.(
        { windowDays: 365 },
        {} as any,
      )) as any;
      assert.equal(listAfterDelete.total, 1);
      assert.equal(listAfterDelete.events[0].title, "Giỗ Cụ");
    } finally {
      closeDatabase(db);
    }
  });

  it("handles non-existent event updates and deletes gracefully", async () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createEventsRepository(db);
      const tools = createEventTools(repo, { chatId: "chat-events", senderName: "Mẹ" });

      const updateRes = (await tools.event_update.execute?.(
        { id: 9999, title: "Sự kiện ảo" },
        {} as any,
      )) as any;
      assert.ok(updateRes);
      assert.equal(updateRes.success, false);

      const deleteRes = (await tools.event_delete.execute?.(
        { id: 9999 },
        {} as any,
      )) as any;
      assert.ok(deleteRes);
      assert.equal(deleteRes.success, false);
    } finally {
      closeDatabase(db);
    }
  });

  it("executes event_send_image for weekly, monthly, and yearly scopes and dispatches photo", async () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createEventsRepository(db);

      // Add a couple of events
      repo.createEvent({
        chatId: "chat-events",
        title: "Sinh nhật Bé",
        kind: "birthday",
        calendar: "solar",
        day: 15,
        month: 10,
        year: 2026,
        createdBy: "Ba",
      });
      repo.createEvent({
        chatId: "chat-events",
        title: "Giỗ Bà Cố",
        kind: "gio",
        calendar: "lunar",
        day: 1,
        month: 9,
        year: null,
        recurrence: "yearly",
        createdBy: "Mẹ",
      });

      const sentPhotos: Array<{ chatId: string; photo: string; caption?: string }> = [];
      const mockZalo = {
        async getWebhookInfo() {
          return { url: "" };
        },
        async setWebhook() {
          return { outcome: "" };
        },
        async testWebhook() {
          return { outcome: "" };
        },
        async sendMessage() {},
        async sendPhoto(chatId: string, photo: string, caption?: string) {
          sentPhotos.push({ chatId, photo, caption });
        },
      };

      const tools = createEventTools(repo, {
        chatId: "chat-events",
        senderName: "Ba",
        zalo: mockZalo,
        publicBaseUrl: "https://mybot.vn",
      });

      // 1. Monthly scope
      const monthRes = (await tools.event_send_image.execute?.(
        { scope: "month", month: 10, year: 2026 },
        {} as any,
      )) as any;

      assert.ok(monthRes);
      assert.equal(monthRes.success, true);
      assert.equal(monthRes.scope, "month");
      assert.equal(monthRes.sentToChannel, true);
      assert.ok(monthRes.imageUrl.startsWith("https://mybot.vn/images/events/events_chat-events_month_"));
      assert.equal(sentPhotos.length, 1);
      assert.equal(sentPhotos[0]?.chatId, "chat-events");
      assert.ok(sentPhotos[0]?.photo.startsWith("https://mybot.vn/images/events/"));

      // 2. Weekly scope
      const weekRes = (await tools.event_send_image.execute?.(
        { scope: "week", date: "2026-10-15" },
        {} as any,
      )) as any;

      assert.ok(weekRes);
      assert.equal(weekRes.success, true);
      assert.equal(weekRes.scope, "week");
      assert.equal(sentPhotos.length, 2);
      assert.ok(sentPhotos[1]?.photo.includes("_week_"));

      // 3. Yearly scope
      const yearRes = (await tools.event_send_image.execute?.(
        { scope: "year", year: 2026 },
        {} as any,
      )) as any;

      assert.ok(yearRes);
      assert.equal(yearRes.success, true);
      assert.equal(yearRes.scope, "year");
      assert.equal(sentPhotos.length, 3);
      assert.ok(sentPhotos[2]?.photo.includes("_year_"));
    } finally {
      closeDatabase(db);
    }
  });
});

