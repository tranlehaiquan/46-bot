import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { ServerDeps } from "../server.js";
import { createAuthHook, createToken } from "./auth.js";
import type { ChannelStatus } from "../db/repositories/channels.js";

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

      const channels = deps.channelRepo ? deps.channelRepo.listChannels(statusFilter) : [];
      return reply.send({ channels });
    });

    adminScope.patch("/api/admin/channels/:chatId", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const body = parseJsonBody(request.body);

      if (!deps.channelRepo) {
        return reply.code(503).send({ error: "Channel repository unavailable" });
      }

      const existing = deps.channelRepo.getChannel(chatId);
      if (!existing) {
        return reply.code(404).send({ error: "Channel not found" });
      }

      if (typeof body.status === "string") {
        const status = body.status as ChannelStatus;
        if (["pending", "active", "disabled"].includes(status)) {
          deps.channelRepo.updateStatus(chatId, status);
        }
      }

      if (typeof body.name === "string" && body.name.trim()) {
        deps.channelRepo.updateName(chatId, body.name.trim());
      }

      const updated = deps.channelRepo.getChannel(chatId);
      return reply.send({ ok: true, channel: updated });
    });

    // 3. Messages: View & Send
    adminScope.get("/api/admin/channels/:chatId/messages", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const query = (request.query || {}) as { limit?: string };
      const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);

      const messages = deps.messageRepo ? deps.messageRepo.getRecent(chatId, limit) : [];
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
          deps.messageRepo.insert({
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
      const events = deps.eventsRepo ? deps.eventsRepo.getEventsByChat(chatId) : [];
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

      const event = deps.eventsRepo.createEvent({
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

    adminScope.delete("/api/admin/channels/:chatId/events/:id", async (request, reply) => {
      const { id } = request.params as { chatId: string; id: string };
      if (!deps.eventsRepo) {
        return reply.code(503).send({ error: "Events repository unavailable" });
      }
      const success = deps.eventsRepo.deleteEvent(Number(id));
      return reply.send({ ok: success });
    });

    // 5. Memory & Stories
    adminScope.get("/api/admin/channels/:chatId/memories", async (request, reply) => {
      const { chatId } = request.params as { chatId: string };
      const facts = deps.memoryRepo ? deps.memoryRepo.listMemories(chatId) : [];
      const stories = deps.memoryRepo ? deps.memoryRepo.listStories(chatId) : [];
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

      const memory = deps.memoryRepo.upsertMemory(chatId, subject, fact, "admin");
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
        success = deps.memoryRepo.deleteMemoryById(chatId, numericId);
      }
      if (!success) {
        success = deps.memoryRepo.deleteMemory(chatId, idOrSubject);
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

      const created = deps.memoryRepo.addStory({
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
      const success = deps.memoryRepo.deleteStory(chatId, Number(id));
      return reply.send({ ok: success });
    });
  });
}
