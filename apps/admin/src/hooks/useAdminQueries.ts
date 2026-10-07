import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  api,
  type Channel,
  type ChannelStatus,
  type Message,
  type EventItem,
  type MemoryFact,
  type MemoryStory,
  type HolidayOccurrence,
  type CalendarEventOccurrence,
  type ScheduledLookup,
  type AdminSettings,
  type UpdateSettingsInput,
  type TestSettingsInput,
  type TestSettingsResult,
} from "../api";

export const queryKeys = {
  channels: (status?: string) => ["channels", status ?? "all"] as const,
  messages: (chatId: string, limit?: number) => ["messages", chatId, limit ?? 50] as const,
  events: (chatId: string) => ["events", chatId] as const,
  memories: (chatId: string) => ["memories", chatId] as const,
  lookups: (chatId: string) => ["lookups", chatId] as const,
  settings: () => ["settings"] as const,
  holidays: (year: number) => ["holidays", year] as const,
  calendarEvents: (year: number, month: number, chatId?: string) =>
    ["calendarEvents", year, month, chatId ?? "all"] as const,
};

// --- Channels ---
export function useChannels(status?: string): UseQueryResult<Channel[], Error> {
  return useQuery({
    queryKey: queryKeys.channels(status),
    queryFn: () => api.getChannels(status),
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      chatId,
      updates,
    }: {
      chatId: string;
      updates: { status?: ChannelStatus; name?: string };
    }) => api.updateChannel(chatId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
  });
}

// --- Messages ---
export function useChannelMessages(
  chatId: string,
  limit = 50,
): UseQueryResult<Message[], Error> {
  return useQuery({
    queryKey: queryKeys.messages(chatId, limit),
    queryFn: () => api.getMessages(chatId, limit),
    enabled: Boolean(chatId),
    refetchInterval: 5000, // Background poll every 5s for real-time feel
  });
}

export function useSendMessage(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.sendMessage(chatId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(chatId) });
    },
  });
}

// --- Events & Reminders ---
export function useChannelEvents(chatId: string): UseQueryResult<EventItem[], Error> {
  return useQuery({
    queryKey: queryKeys.events(chatId),
    queryFn: () => api.getEvents(chatId),
    enabled: Boolean(chatId),
  });
}

export function useCreateEvent(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (event: Partial<EventItem>) => api.createEvent(chatId, event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events(chatId) });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
  });
}

export function useUpdateEvent(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<EventItem> }) =>
      api.updateEvent(chatId, id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events(chatId) });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
  });
}

export function useDeleteEvent(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteEvent(chatId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events(chatId) });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
  });
}

// --- Memories & Stories ---
export function useChannelMemories(
  chatId: string,
): UseQueryResult<{ facts: MemoryFact[]; stories: MemoryStory[] }, Error> {
  return useQuery({
    queryKey: queryKeys.memories(chatId),
    queryFn: () => api.getMemories(chatId),
    enabled: Boolean(chatId),
  });
}

export function useCreateFact(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subject, fact }: { subject: string; fact: string }) =>
      api.createFact(chatId, subject, fact),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories(chatId) });
    },
  });
}

export function useDeleteFact(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (idOrSubject: string | number) => api.deleteFact(chatId, idOrSubject),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories(chatId) });
    },
  });
}

export function useCreateStory(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (story: {
      title: string;
      story: string;
      people?: string;
      happenedOn?: string;
    }) => api.createStory(chatId, story),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories(chatId) });
    },
  });
}

export function useDeleteStory(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteStory(chatId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memories(chatId) });
    },
  });
}

// --- Scheduled Lookups ---
export function useChannelLookups(
  chatId: string,
): UseQueryResult<ScheduledLookup[], Error> {
  return useQuery({
    queryKey: queryKeys.lookups(chatId),
    queryFn: () => api.getLookups(chatId),
    enabled: Boolean(chatId),
  });
}

export function useUpdateLookup(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: number;
      updates: { active?: boolean; instruction?: string };
    }) => api.updateLookup(chatId, id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lookups(chatId) });
    },
  });
}

export function useDeleteLookup(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteLookup(chatId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lookups(chatId) });
    },
  });
}

// --- Holidays & Calendar ---
export function useHolidays(year?: number): UseQueryResult<HolidayOccurrence[], Error> {
  const currentYear = year ?? new Date().getFullYear();
  return useQuery({
    queryKey: queryKeys.holidays(currentYear),
    queryFn: () => api.getHolidays(currentYear),
    staleTime: 1000 * 60 * 60, // Holidays rarely change, cache 1 hour
  });
}

export function useCalendarEvents(
  year: number,
  month: number,
  chatId?: string,
): UseQueryResult<CalendarEventOccurrence[], Error> {
  return useQuery({
    queryKey: queryKeys.calendarEvents(year, month, chatId),
    queryFn: () => api.getCalendarEvents(year, month, chatId),
  });
}

// --- Settings ---
export function useSettings(): UseQueryResult<AdminSettings, Error> {
  return useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => api.getSettings(),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: UpdateSettingsInput) => api.updateSettings(updates),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.settings(), updated);
    },
  });
}

export function useTestSettings() {
  return useMutation({
    mutationFn: (input: TestSettingsInput) => api.testSettings(input),
  });
}

