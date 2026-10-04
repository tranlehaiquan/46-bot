import React, { useState, useEffect } from "react";
import { Router, useLocation, useRoute } from "wouter";
import { api, type Channel, type ChannelStatus } from "./api";
import { Login } from "./components/Login";
import { Navbar } from "./components/Navbar";
import { ChannelList } from "./components/ChannelList";
import { ChannelDetail } from "./components/ChannelDetail";
import { CalendarPage } from "./components/CalendarPage";
import { MessageSquareOff, AlertCircle } from "lucide-react";

function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(api.isAuthenticated());
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(false);

  const [, navigate] = useLocation();
  const [isChatRoute, chatParams] = useRoute("/chat/:chatId");
  const [isChannelRoute, channelParams] = useRoute("/channels/:chatId");
  const [isCalendarRoute] = useRoute("/calendar");

  const routeChatId = chatParams?.chatId || channelParams?.chatId || null;
  const currentPage: "channels" | "calendar" = isCalendarRoute ? "calendar" : "channels";

  useEffect(() => {
    const handleAuthExpired = () => {
      setIsAuthenticated(false);
      setChannels([]);
      setSelectedChannel(null);
    };
    window.addEventListener("auth-expired", handleAuthExpired);
    return () => window.removeEventListener("auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadChannels();
    }
  }, [isAuthenticated]);

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

  const loadChannels = async () => {
    setLoading(true);
    try {
      const list = await api.getChannels();
      setChannels(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
      const updated = await api.updateChannel(chatId, { status });
      setChannels((prev) => prev.map((c) => (c.chatId === chatId ? updated : c)));
      if (selectedChannel?.chatId === chatId) {
        setSelectedChannel(updated);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update channel status");
    }
  };

  const handleChannelUpdated = (updated: Channel) => {
    setChannels((prev) => prev.map((c) => (c.chatId === updated.chatId ? updated : c)));
    setSelectedChannel(updated);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        channels={channels}
        onLogout={() => setIsAuthenticated(false)}
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
            />

            {selectedChannel ? (
              <ChannelDetail
                channel={selectedChannel}
                onChannelUpdated={handleChannelUpdated}
              />
            ) : routeChatId && !loading ? (
              <div className="glass-panel h-[calc(100vh-120px)] flex flex-col items-center justify-center text-slate-400 gap-4 text-center p-8">
                <AlertCircle size={48} className="text-amber-500 opacity-80" />
                <h4 className="text-lg font-semibold text-slate-100">
                  Channel Not Found
                </h4>
                <p className="max-w-md text-sm text-slate-400">
                  No channel matching ID <code className="font-mono text-indigo-400">{routeChatId}</code> was found.
                </p>
                {channels.length > 0 && (
                  <button
                    onClick={() => handleSelectChannel(channels[0])}
                    className="btn btn-secondary mt-2"
                  >
                    Go to {channels[0].name}
                  </button>
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
    <Router base="/admin">
      <AdminApp />
    </Router>
  );
}

export default App;
