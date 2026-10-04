export type ChannelStatus = "pending" | "active" | "disabled";

export type Channel = {
  chatId: string;
  name: string;
  chatType: "GROUP" | "PRIVATE";
  status: ChannelStatus;
  createdAt: number;
  lastActiveAt: number;
};

export type Message = {
  id: number;
  chatId: string;
  senderId: string;
  senderName: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
};

export type EventItem = {
  id: number;
  chatId: string;
  title: string;
  kind: string;
  calendar: "solar" | "lunar";
  day: number;
  month: number;
  year: number | null;
  recurrence: string;
  remindDaysBefore: number;
  notes: string | null;
};

export type MemoryFact = {
  id: number;
  chatId: string;
  subject: string;
  fact: string;
  createdBy: string;
  ts: number;
};

export type MemoryStory = {
  id: number;
  chatId: string;
  title: string;
  story: string;
  people: string;
  happenedOn: string | null;
  createdBy: string;
  ts: number;
};

export type HolidayOccurrence = {
  id: string;
  name: string;
  calendar: "solar" | "lunar";
  originalDate: string;
  occurrenceDateStr: string;
  daysRemaining: number;
  daysOfLeave?: number;
  isPublicHoliday: boolean;
  description?: string;
};

export type CalendarEventOccurrence = {
  eventId: number;
  chatId: string;
  channelName: string;
  title: string;
  kind: string;
  calendar: string;
  occurrenceDateStr: string;
};

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("bot_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem("bot_admin_token");
    window.dispatchEvent(new Event("auth-expired"));
    throw new Error("Phiên làm việc hết hạn hoặc mật khẩu không đúng.");
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Yêu cầu thất bại");
  }
  return data as T;
}

export const api = {
  async login(password: string): Promise<string> {
    const res = await request<{ ok: boolean; token: string }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    localStorage.setItem("bot_admin_token", res.token);
    return res.token;
  },

  logout(): void {
    localStorage.removeItem("bot_admin_token");
    window.dispatchEvent(new Event("auth-expired"));
  },

  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem("bot_admin_token"));
  },

  async getChannels(status?: string): Promise<Channel[]> {
    const url = status && status !== "all" ? `/api/admin/channels?status=${status}` : "/api/admin/channels";
    const res = await request<{ channels: Channel[] }>(url);
    return res.channels;
  },

  async updateChannel(chatId: string, updates: { status?: ChannelStatus; name?: string }): Promise<Channel> {
    const res = await request<{ ok: boolean; channel: Channel }>(`/api/admin/channels/${encodeURIComponent(chatId)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    return res.channel;
  },

  async getMessages(chatId: string, limit = 50): Promise<Message[]> {
    const res = await request<{ messages: Message[] }>(`/api/admin/channels/${encodeURIComponent(chatId)}/messages?limit=${limit}`);
    return res.messages;
  },

  async sendMessage(chatId: string, content: string): Promise<{ ok: boolean; messageId: string }> {
    return request(`/api/admin/channels/${encodeURIComponent(chatId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },

  async getEvents(chatId: string): Promise<EventItem[]> {
    const res = await request<{ events: EventItem[] }>(`/api/admin/channels/${encodeURIComponent(chatId)}/events`);
    return res.events;
  },

  async createEvent(chatId: string, event: Partial<EventItem>): Promise<EventItem> {
    const res = await request<{ ok: boolean; event: EventItem }>(`/api/admin/channels/${encodeURIComponent(chatId)}/events`, {
      method: "POST",
      body: JSON.stringify(event),
    });
    return res.event;
  },

  async deleteEvent(chatId: string, id: number): Promise<void> {
    await request(`/api/admin/channels/${encodeURIComponent(chatId)}/events/${id}`, {
      method: "DELETE",
    });
  },

  async getMemories(chatId: string): Promise<{ facts: MemoryFact[]; stories: MemoryStory[] }> {
    return request(`/api/admin/channels/${encodeURIComponent(chatId)}/memories`);
  },

  async createFact(chatId: string, subject: string, fact: string): Promise<MemoryFact> {
    const res = await request<{ ok: boolean; memory: MemoryFact }>(`/api/admin/channels/${encodeURIComponent(chatId)}/memories/facts`, {
      method: "POST",
      body: JSON.stringify({ subject, fact }),
    });
    return res.memory;
  },

  async deleteFact(chatId: string, idOrSubject: string | number): Promise<void> {
    await request(`/api/admin/channels/${encodeURIComponent(chatId)}/memories/facts/${encodeURIComponent(idOrSubject)}`, {
      method: "DELETE",
    });
  },

  async createStory(chatId: string, story: { title: string; story: string; people?: string; happenedOn?: string }): Promise<MemoryStory> {
    const res = await request<{ ok: boolean; story: MemoryStory }>(`/api/admin/channels/${encodeURIComponent(chatId)}/memories/stories`, {
      method: "POST",
      body: JSON.stringify(story),
    });
    return res.story;
  },

  async deleteStory(chatId: string, id: number): Promise<void> {
    await request(`/api/admin/channels/${encodeURIComponent(chatId)}/memories/stories/${id}`, {
      method: "DELETE",
    });
  },

  async getHolidays(year?: number): Promise<HolidayOccurrence[]> {
    const y = year ?? new Date().getFullYear();
    const res = await request<{ holidays: HolidayOccurrence[] }>(`/api/admin/holidays?year=${y}`);
    return res.holidays;
  },

  async getCalendarEvents(year: number, month: number, chatId?: string): Promise<CalendarEventOccurrence[]> {
    const base = `/api/admin/calendar/events?year=${year}&month=${month}`;
    const url = chatId ? `${base}&chatId=${encodeURIComponent(chatId)}` : base;
    const res = await request<{ events: CalendarEventOccurrence[] }>(url);
    return res.events;
  },
};
