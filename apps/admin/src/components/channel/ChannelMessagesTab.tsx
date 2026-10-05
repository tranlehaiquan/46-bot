import React, { useRef, useEffect } from "react";
import type { Message } from "../../api";

interface ChannelMessagesTabProps {
  messages: Message[];
}

export function ChannelMessagesTab({ messages }: ChannelMessagesTabProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3.5">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 m-auto text-sm">
            No recorded messages for this channel yet.
          </div>
        ) : (
          messages.map((m) => {
            const isAssistant = m.role === "assistant";
            return (
              <div
                key={m.id}
                className={`flex flex-col max-w-[75%] ${
                  isAssistant ? "items-end self-end" : "items-start self-start"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <span className={`font-semibold ${isAssistant ? "text-indigo-400" : "text-slate-300"}`}>
                    {isAssistant ? "🤖 46-Bot" : m.senderName || m.senderId}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(m.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div
                  className={`p-3 px-4 rounded-2xl leading-relaxed text-sm whitespace-pre-wrap break-words ${
                    isAssistant
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-slate-800 text-slate-100 border border-white/[0.08]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
