import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ServerDeps } from "../server.js";
import { createAuthHook, createToken } from "./auth.js";
import type { ChannelStatus } from "../db/repositories/channels.js";
import { getChannelActivatedMessage } from "../delivery.js";
import { getUpcomingHolidays } from "../holidays/index.js";
import { getNextOccurrence, createUtc7Date, getUtc7Parts } from "../db/repositories/events.js";

function parseJsonBody(body: unknown): Record<string, unknown> {
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString("utf8")) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof body === "object" && body !== null) {
    return body as Record<string, unknown>;
  }
  return {};
}

export function registerAdminRoutes(app: FastifyInstance, deps: ServerDeps): void {
  const requireAuth = createAuthHook(deps.config.adminPassword);

  app.register(async (adminScope) => {
    adminScope.addHook("preHandler", requireAuth);

    // 1. Auth: Login
    adminScope.post("/api/admin/login", async (request, reply) => {
      const body = parseJsonBody(request.body);
      const password = typeof body.password === "string" ? body.password : "";
      if (password && password === deps.config.adminPassword) {
        const token = createToken(deps.config.adminPassword);
        return reply.code(200).send({ ok: true, token });
      }
      return reply.code(401).send({ error: "Invalid password" });
    });

    // 2. Channels: List & Update
    adminScope.get("/api/admin/channels", async (request, reply) => {
      const query = (request.query || {}) as { status?: string };
      const validStatuses: ChannelStatus[] = ["pending", "active", "disabled"];
      const statusFilter = validStatuses.includes(query.status as ChannelStatus)
        ? (query.status as ChannelStatus)
        : undefined;

      const channels = deps.channelRepo ? await deps.channelRepo.listChannels(statusFilter) : [];
      return reply.send({ channels });
    });

    adminScope.patch("/api/admin/channels/:chatId", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const body = parseJsonBody(request.body);

      if (!deps.channelRepo) {
        return reply.code(503).send({ error: "Channel repository unavailable" });
      }

      const existing = await deps.channelRepo.getChannel(chatId);
      if (!existing) {
        return reply.code(404).send({ error: "Channel not found" });
      }

      const activatesPendingChannel = existing.status === "pending" && body.status === "active";
      if (typeof body.status === "string") {
        const status = body.status as ChannelStatus;
        if (["pending", "active", "disabled"].includes(status)) {
          await deps.channelRepo.updateStatus(chatId, status);
        }
      }

      if (typeof body.name === "string" && body.name.trim()) {
        await deps.channelRepo.updateName(chatId, body.name.trim());
      }

      const updated = await deps.channelRepo.getChannel(chatId);
      if (activatesPendingChannel) {
        try {
          const content = getChannelActivatedMessage();
          await deps.zalo.sendMessage(chatId, content);
          if (deps.messageRepo) {
            await deps.messageRepo.insert({
              chatId,
              senderId: "bot",
              senderName: "Admin",
              role: "assistant",
              content,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          deps.log.error({ event: "admin_channel_activation_message_failed", chat_id: chatId, message });
        }
      }
      return reply.send({ ok: true, channel: updated });
    });

    // 3. Messages: View & Send
    adminScope.get("/api/admin/channels/:chatId/messages", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const query = (request.query || {}) as { limit?: string };
      const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);

      const messages = deps.messageRepo ? await deps.messageRepo.getRecent(chatId, limit) : [];
      return reply.send({ messages });
    });

    adminScope.post("/api/admin/channels/:chatId/messages", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const body = parseJsonBody(request.body);
      const content = typeof body.content === "string" ? body.content.trim() : "";

      if (!content) {
        return reply.code(400).send({ error: "Content is required" });
      }

      try {
        await deps.zalo.sendMessage(chatId, content);
        if (deps.messageRepo) {
          await deps.messageRepo.insert({
            chatId,
            senderId: "bot",
            senderName: "Admin",
            role: "assistant",
            content,
          });
        }
        return reply.send({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        deps.log.error({ event: "admin_send_failed", message });
        return reply.code(502).send({ error: "Failed to send message via Zalo" });
      }
    });

    // 4. Reminders & Events
    adminScope.get("/api/admin/channels/:chatId/events", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const events = deps.eventsRepo ? await deps.eventsRepo.getEventsByChat(chatId) : [];
      return reply.send({ events });
    });

    adminScope.post("/api/admin/channels/:chatId/events", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const body = parseJsonBody(request.body);

      if (!deps.eventsRepo) {
        return reply.code(503).send({ error: "Events repository unavailable" });
      }

      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        return reply.code(400).send({ error: "Title is required" });
      }

      const event = await deps.eventsRepo.createEvent({
        chatId,
        title,
        kind: (body.kind as any) ?? "event",
        calendar: (body.calendar as any) ?? "solar",
        day: Number(body.day) || 1,
        month: Number(body.month) || 1,
        year: body.year ? Number(body.year) : undefined,
        recurrence: (body.recurrence as any) ?? "yearly",
        remindDaysBefore: Number(body.remindDaysBefore) || 0,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        createdBy: "admin",
      });

      return reply.code(201).send({ ok: true, event });
    });

    adminScope.patch("/api/admin/channels/:chatId/events/:id", async (request, reply) => {
      const { id } = request.params as { chatId: string; id: string };
      const body = parseJsonBody(request.body);

      if (!deps.eventsRepo) {
        return reply.code(503).send({ error: "Events repository unavailable" });
      }

      const eventId = Number(id);
      const existing = await deps.eventsRepo.getEventById(eventId);
      if (!existing) {
        return reply.code(404).send({ error: "Event not found" });
      }

      const updated = await deps.eventsRepo.updateEvent(eventId, {
        title: typeof body.title === "string" ? body.title : undefined,
        kind: body.kind as any,
        calendar: body.calendar as any,
        day: body.day !== undefined ? Number(body.day) : undefined,
        month: body.month !== undefined ? Number(body.month) : undefined,
        year: body.year !== undefined ? (body.year ? Number(body.year) : null) : undefined,
        isLeapMonth: typeof body.isLeapMonth === "boolean" ? body.isLeapMonth : undefined,
        recurrence: body.recurrence as any,
        remindDaysBefore: body.remindDaysBefore !== undefined ? Number(body.remindDaysBefore) : undefined,
        notes: typeof body.notes === "string" ? body.notes : (body.notes === null ? null : undefined),
      });

      return reply.send({ ok: true, event: updated });
    });

    adminScope.delete("/api/admin/channels/:chatId/events/:id", async (request, reply) => {
      const { id } = request.params as { chatId: string; id: string };
      if (!deps.eventsRepo) {
        return reply.code(503).send({ error: "Events repository unavailable" });
      }
      const success = await deps.eventsRepo.deleteEvent(Number(id));
      return reply.send({ ok: success });
    });

    // 5. Memory & Stories
    adminScope.get("/api/admin/channels/:chatId/memories", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const facts = deps.memoryRepo ? await deps.memoryRepo.listMemories(chatId) : [];
      const stories = deps.memoryRepo ? await deps.memoryRepo.listStories(chatId) : [];
      return reply.send({ facts, stories });
    });

    adminScope.post("/api/admin/channels/:chatId/memories/facts", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const body = parseJsonBody(request.body);

      if (!deps.memoryRepo) {
        return reply.code(503).send({ error: "Memory repository unavailable" });
      }

      const subject = typeof body.subject === "string" ? body.subject.trim() : "";
      const fact = typeof body.fact === "string" ? body.fact.trim() : "";

      if (!subject || !fact) {
        return reply.code(400).send({ error: "Subject and fact are required" });
      }

      const memory = await deps.memoryRepo.upsertMemory(chatId, subject, fact, "admin");
      return reply.code(201).send({ ok: true, memory });
    });

    adminScope.delete("/api/admin/channels/:chatId/memories/facts/:idOrSubject", async (request, reply) => {
      const { chatId, idOrSubject } = request.params as { chatId: string; idOrSubject: string };
      if (!deps.memoryRepo) {
        return reply.code(503).send({ error: "Memory repository unavailable" });
      }

      const numericId = Number(idOrSubject);
      let success = false;
      if (!Number.isNaN(numericId)) {
        success = await deps.memoryRepo.deleteMemoryById(chatId, numericId);
      }
      if (!success) {
        success = await deps.memoryRepo.deleteMemory(chatId, idOrSubject);
      }
      return reply.send({ ok: success });
    });

    adminScope.post("/api/admin/channels/:chatId/memories/stories", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const body = parseJsonBody(request.body);

      if (!deps.memoryRepo) {
        return reply.code(503).send({ error: "Memory repository unavailable" });
      }

      const title = typeof body.title === "string" ? body.title.trim() : "";
      const story = typeof body.story === "string" ? body.story.trim() : "";

      if (!title || !story) {
        return reply.code(400).send({ error: "Title and story are required" });
      }

      const created = await deps.memoryRepo.addStory({
        chatId,
        title,
        story,
        people: typeof body.people === "string" ? body.people : undefined,
        happenedOn: typeof body.happenedOn === "string" ? body.happenedOn : undefined,
        createdBy: "admin",
      });

      return reply.code(201).send({ ok: true, story: created });
    });

    adminScope.delete("/api/admin/channels/:chatId/memories/stories/:id", async (request, reply) => {
      const { chatId, id } = request.params as { chatId: string; id: string };
      if (!deps.memoryRepo) {
        return reply.code(503).send({ error: "Memory repository unavailable" });
      }
      const success = await deps.memoryRepo.deleteStory(chatId, Number(id));
      return reply.send({ ok: success });
    });

    // 6. Calendar: Vietnam Holidays
    adminScope.get("/api/admin/holidays", async (request, reply) => {
      const query = (request.query || {}) as { year?: string };
      const year = Number(query.year) || new Date().getFullYear();
      // Use Jan 1 of that year as reference, window of 400 days covers the full year
      const referenceDate = createUtc7Date(year, 1, 1);
      const holidays = getUpcomingHolidays({ windowDays: 400, referenceDate });
      return reply.send({ holidays });
    });

    // 7. Calendar: Channel Events with computed occurrences
    adminScope.get("/api/admin/calendar/events", async (request, reply) => {
      const query = (request.query || {}) as { year?: string; month?: string; chatId?: string };
      const year = Number(query.year) || new Date().getFullYear();
      const month = Math.min(12, Math.max(1, Number(query.month) || new Date().getMonth() + 1));
      const chatIdFilter = typeof query.chatId === "string" && query.chatId ? query.chatId : undefined;

      if (!deps.eventsRepo) {
        return reply.send({ events: [] });
      }

      const allEvents = chatIdFilter
        ? await deps.eventsRepo.getEventsByChat(chatIdFilter)
        : await deps.eventsRepo.getAllEvents();

      // Reference is the first day of the requested month
      const refDate = createUtc7Date(year, month, 1);

      const events: Array<{
        eventId: number;
        chatId: string;
        channelName: string;
        title: string;
        kind: string;
        calendar: string;
        occurrenceDateStr: string;
      }> = [];

      for (const event of allEvents) {
        const occ = getNextOccurrence(event, refDate);
        if (!occ) continue;
        // Only include occurrences that fall within the requested month
        const occParts = getUtc7Parts(occ.date);
        if (occParts.year !== year || occParts.month !== month) continue;

        const channel = deps.channelRepo ? await deps.channelRepo.getChannel(event.chatId) : undefined;
        events.push({
          eventId: event.id,
          chatId: event.chatId,
          channelName: channel?.name ?? event.chatId,
          title: event.title,
          kind: event.kind,
          calendar: event.calendar,
          occurrenceDateStr: occ.dateStr,
        });
      }

      return reply.send({ events });
    });

    // 8. Lookups: List, Pause/Resume, Delete
    adminScope.get("/api/admin/channels/:chatId/lookups", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      if (!deps.lookupsRepo) {
        return reply.send({ lookups: [] });
      }
      const lookups = await deps.lookupsRepo.listLookups(chatId);
      return reply.send({ lookups });
    });

    adminScope.patch("/api/admin/channels/:chatId/lookups/:id", async (request, reply) => {
      const { chatId, id } = request.params as { chatId: string; id: string };
      const body = parseJsonBody(request.body);

      if (!deps.lookupsRepo) {
        return reply.code(503).send({ error: "Lookup repository unavailable" });
      }

      const lookupId = Number(id);
      const existing = await deps.lookupsRepo.getLookupById(lookupId);
      if (!existing || existing.chatId !== chatId) {
        return reply.code(404).send({ error: "Lookup not found" });
      }

      const active = typeof body.active === "boolean" ? body.active : undefined;
      const instruction = typeof body.instruction === "string" ? body.instruction : undefined;

      const updated = await deps.lookupsRepo.updateLookup(lookupId, {
        active,
        instruction,
      });

      return reply.send({ ok: true, lookup: updated });
    });

    adminScope.delete("/api/admin/channels/:chatId/lookups/:id", async (request, reply) => {
      const { chatId, id } = request.params as { chatId: string; id: string };

      if (!deps.lookupsRepo) {
        return reply.code(503).send({ error: "Lookup repository unavailable" });
      }

      const lookupId = Number(id);
      const existing = await deps.lookupsRepo.getLookupById(lookupId);
      if (!existing || existing.chatId !== chatId) {
        return reply.code(404).send({ error: "Lookup not found" });
      }

      const success = await deps.lookupsRepo.cancelLookup(lookupId);
      return reply.send({ ok: success });
    });

    // 9. Export & Backup Routes
    adminScope.get("/api/admin/export/json", async (_request, reply) => {
      if (!deps.db) {
        return reply.code(503).send({ error: "Database unavailable for export" });
      }

      const channels = (await deps.db.execute("SELECT * FROM channels ORDER BY created_at ASC")).rows;
      const events = (await deps.db.execute("SELECT * FROM events ORDER BY month ASC, day ASC")).rows;
      const facts = (await deps.db.execute("SELECT * FROM memories ORDER BY ts ASC")).rows;
      const stories = (await deps.db.execute("SELECT * FROM memory_book ORDER BY ts ASC")).rows;
      const lists = (await deps.db.execute("SELECT * FROM lists ORDER BY created_at ASC")).rows;
      const listItems = (await deps.db.execute("SELECT * FROM list_items ORDER BY ts ASC")).rows;
      const lookups = (await deps.db.execute("SELECT * FROM scheduled_lookups ORDER BY created_at ASC")).rows;
      const lookupRuns = (await deps.db.execute("SELECT * FROM scheduled_lookup_runs ORDER BY id DESC LIMIT 500")).rows;
      const messages = (await deps.db.execute("SELECT * FROM messages ORDER BY ts DESC LIMIT 1000")).rows;

      const dateStr = new Date().toISOString().slice(0, 10);
      const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        stats: {
          channels: channels.length,
          events: events.length,
          facts: facts.length,
          stories: stories.length,
          lists: lists.length,
          listItems: listItems.length,
          lookups: lookups.length,
          lookupRuns: lookupRuns.length,
          messages: messages.length,
        },
        data: {
          channels,
          events,
          facts,
          stories,
          lists,
          listItems,
          lookups,
          lookupRuns,
          messages,
        },
      };

      return reply
        .header("Content-Type", "application/json; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="46bot-backup-${dateStr}.json"`)
        .send(payload);
    });

    adminScope.get("/api/admin/export/db", async (_request, reply) => {
      if (!deps.db) {
        return reply.code(503).send({ error: "Database unavailable for export" });
      }

      try {
        const tmpPath = path.join(os.tmpdir(), `export-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
        await deps.db.execute(`VACUUM INTO '${tmpPath}'`);
        const buffer = await fs.promises.readFile(tmpPath);
        await fs.promises.unlink(tmpPath).catch(() => {});

        const dateStr = new Date().toISOString().slice(0, 10);
        return reply
          .header("Content-Type", "application/x-sqlite3")
          .header("Content-Disposition", `attachment; filename="46bot-backup-${dateStr}.sqlite"`)
          .send(buffer);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        deps.log.error({ event: "db_export_failed", message });
        return reply.code(500).send({ error: "Failed to export sqlite database" });
      }
    });
  });
}
