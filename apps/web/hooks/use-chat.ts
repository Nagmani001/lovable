"use client";

import { useState, useCallback } from "react";
import { streamChat } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ToolCallInfo {
  name: string;
  status: "started" | "completed" | "failed";
  path?: string;
}

export function useChat(projectId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallInfo[]>([]);
  const [agentStatus, setAgentStatus] = useState<string>("idle");

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, msg]);
      return msg.id;
    },
    [],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!projectId || isStreaming) return;

      addMessage("user", content);
      setIsStreaming(true);
      setAgentStatus("thinking");

      let assistantText = "";
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      try {
        for await (const event of streamChat(projectId, content)) {
          switch (event.type) {
            case "text": {
              const textData = event.data as { content: string };
              assistantText += textData.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantText } : m,
                ),
              );
              break;
            }

            case "tool_call": {
              const toolData = event.data as unknown as ToolCallInfo;
              setActiveToolCalls((prev) => {
                if (toolData.status === "started") {
                  return [...prev, toolData];
                }
                return prev.filter((t) => t.name !== toolData.name);
              });
              break;
            }

            case "status": {
              const statusData = event.data as { status: string };
              setAgentStatus(statusData.status);
              break;
            }

            case "file_change": {
              break;
            }

            case "error": {
              const errorData = event.data as { message: string };
              assistantText += `\n\nError: ${errorData.message}`;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantText } : m,
                ),
              );
              break;
            }

            case "done": {
              break;
            }
          }
        }
      } catch (err) {
        assistantText += `\n\nConnection error. Please try again.`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantText } : m,
          ),
        );
      } finally {
        setIsStreaming(false);
        setActiveToolCalls([]);
        setAgentStatus("idle");
      }
    },
    [projectId, isStreaming, addMessage],
  );

  const loadHistory = useCallback(
    (
      history: Array<{
        contents: string;
        from: "USER" | "ASSISTANT";
        createdAT: string;
      }>,
    ) => {
      const msgs: ChatMessage[] = history.map((h) => ({
        id: crypto.randomUUID(),
        role: h.from === "USER" ? "user" : "assistant",
        content: h.contents,
        timestamp: new Date(h.createdAT),
      }));
      setMessages(msgs);
    },
    [],
  );

  return {
    messages,
    sendMessage,
    isStreaming,
    activeToolCalls,
    agentStatus,
    loadHistory,
  };
}
