import React, { useState, useEffect } from "react";
import { Router, useLocation, useRoute } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { api, type Channel, type ChannelStatus } from "./api";
import { Login } from "./components/Login";
import { Navbar } from "./components/Navbar";
import { ChannelList } from "./components/ChannelList";
import { ChannelDetail } from "./components/ChannelDetail";
import { CalendarPage } from "./components/CalendarPage";
import { MessageSquareOff, AlertCircle } from "lucide-react";
import { Button } from "./components/ui/button";
import { useChannels, useUpdateChannel } from "./hooks/useAdminQueries";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AdminApp() {
  const qc = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(api.isAuthenticated());
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  const [, navigate] = useLocation();
  const [, chatParams] = useRoute("/chat/:chatId");
  const [, channelParams] = useRoute("/channels/:chatId");
  const [isCalendarRoute] = useRoute("/calendar");

  const routeChatId = chatParams?.chatId || channelParams?.chatId || null;
  const currentPage: "channels" | "calendar" = isCalendarRoute ? "calendar" : "channels";

  // TanStack Query for channels
  const channelsQuery = useChannels();
  const channels = channelsQuery.data ?? [];
  const updateChannelMutation = useUpdateChannel();

  useEffect(() => {
    const handleAuthExpired = () => {
      setIsAuthenticated(false);
      setSelectedChannel(null);
      qc.clear();
    };
    window.addEventListener("auth-expired", handleAuthExpired);
    return () => window.removeEventListener("auth-expired", handleAuthExpired);
  }, [qc]);

  // Sync routeChatId to selectedChannel whenever route or channel list changes
  useEffect(() => {
    if (!channels.length) return;

    if (routeChatId) {
      const decodedChatId = decodeURIComponent(routeChatId);
      const found = channels.find((c) => c.chatId === decodedChatId);
      if (found) {
        setSelectedChannel(found);
      } else {
        setSelectedChannel(null);
      }
    } else if (!isCalendarRoute) {
      // Default /admin or /admin/ route without chatId: select first channel and update URL
      const first = channels[0];
      setSelectedChannel(first);
      navigate(`/chat/${encodeURIComponent(first.chatId)}`, { replace: true });
    }
  }, [routeChatId, channels, isCalendarRoute, navigate]);

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    navigate(`/chat/${encodeURIComponent(channel.chatId)}`);
  };

  const handleNavigatePage = (page: "channels" | "calendar") => {
    if (page === "calendar") {
      navigate("/calendar");
    } else {
      if (selectedChannel) {
        navigate(`/chat/${encodeURIComponent(selectedChannel.chatId)}`);
      } else if (channels.length > 0) {
        navigate(`/chat/${encodeURIComponent(channels[0].chatId)}`);
      } else {
        navigate("/");
      }
    }
  };

  const handleUpdateStatus = async (chatId: string, status: ChannelStatus) => {
    try {
      const updated = await updateChannelMutation.mutateAsync({
        chatId,
        updates: { status },
      });
      if (selectedChannel?.chatId === chatId) {
        setSelectedChannel(updated);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update channel status");
    }
  };

  const handleRenameChannel = async (chatId: string, name: string) => {
    try {
      const updated = await updateChannelMutation.mutateAsync({
        chatId,
        updates: { name },
      });
      if (selectedChannel?.chatId === chatId) {
        setSelectedChannel(updated);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename channel");
      throw err;
    }
  };

  const handleChannelUpdated = (updated: Channel) => {
    setSelectedChannel(updated);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        channels={channels}
        onLogout={() => {
          setIsAuthenticated(false);
          qc.clear();
        }}
        currentPage={currentPage}
        onNavigate={handleNavigatePage}
      />

      <main className="flex-1 px-6 pb-6">
        {isCalendarRoute ? (
          <CalendarPage channels={channels} />
        ) : (
          <div className="grid grid-cols-[360px_1fr] gap-5 items-start">
            <ChannelList
              channels={channels}
              selectedChannel={selectedChannel}
              onSelectChannel={handleSelectChannel}
              onUpdateStatus={handleUpdateStatus}
              onRenameChannel={handleRenameChannel}
            />

            {selectedChannel ? (
              <ChannelDetail
                key={selectedChannel.chatId}
                channel={selectedChannel}
                onChannelUpdated={handleChannelUpdated}
              />
            ) : routeChatId && !channelsQuery.isLoading ? (
              <div className="glass-panel h-[calc(100vh-120px)] flex flex-col items-center justify-center text-slate-400 gap-4 text-center p-8">
                <AlertCircle size={48} className="text-amber-500 opacity-80" />
                <h4 className="text-lg font-semibold text-slate-100">
                  Channel Not Found
                </h4>
                <p className="max-w-md text-sm text-slate-400">
                  No channel matching ID <code className="font-mono text-indigo-400">{routeChatId}</code> was found.
                </p>
                {channels.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => handleSelectChannel(channels[0])}
                    className="mt-2"
                  >
                    Go to {channels[0].name}
                  </Button>
                )}
              </div>
            ) : (
              <div className="glass-panel h-[calc(100vh-120px)] flex flex-col items-center justify-center text-slate-400 gap-4 text-center p-8">
                <MessageSquareOff size={48} className="opacity-40" />
                <p className="text-sm">Select a channel on the left to view messages, reminders and memory.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router base="/admin">
        <AdminApp />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
