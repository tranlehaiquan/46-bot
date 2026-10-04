import React, { useState, useEffect } from "react";
import { api, type Channel, type ChannelStatus } from "./api";
import { Login } from "./components/Login";
import { Navbar } from "./components/Navbar";
import { ChannelList } from "./components/ChannelList";
import { ChannelDetail } from "./components/ChannelDetail";
import { MessageSquareOff } from "lucide-react";

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(api.isAuthenticated());
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(false);

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

  const loadChannels = async () => {
    setLoading(true);
    try {
      const list = await api.getChannels();
      setChannels(list);
      // Auto-select first channel or maintain current selection
      if (list.length > 0) {
        setSelectedChannel((prev) => {
          if (!prev) return list[0];
          const found = list.find((c) => c.chatId === prev.chatId);
          return found || list[0];
        });
      } else {
        setSelectedChannel(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
      alert(err instanceof Error ? err.message : "Cập nhật trạng thái thất bại");
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar
        channels={channels}
        onLogout={() => setIsAuthenticated(false)}
      />

      <main style={{
        flex: 1,
        padding: "0 1.5rem 1.5rem 1.5rem",
        display: "grid",
        gridTemplateColumns: "360px 1fr",
        gap: "1.25rem",
        alignItems: "start"
      }}>
        <ChannelList
          channels={channels}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
          onUpdateStatus={handleUpdateStatus}
        />

        {selectedChannel ? (
          <ChannelDetail
            channel={selectedChannel}
            onChannelUpdated={handleChannelUpdated}
          />
        ) : (
          <div className="glass-panel" style={{
            height: "calc(100vh - 120px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            gap: "1rem"
          }}>
            <MessageSquareOff size={48} opacity={0.4} />
            <p>Chọn một kênh bên trái để xem tin nhắn, nhắc nhở và bộ nhớ.</p>
          </div>
        )}
      </main>
    </div>
  );
}
export default App;
