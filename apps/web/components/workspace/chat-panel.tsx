"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, ImagePlus, X, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/components/dialog";
import { useChatImage } from "@/hooks/use-chat-image";
import { prettifyPrompt } from "@/lib/api";
import type { ChatMessage, ChatImageAttachment } from "@/hooks/use-chat";
import type { UploadedImageKeys } from "@/lib/chat-image";

interface ChatPanelProps {
  projectId: string;
  messages: ChatMessage[];
  onSendMessage: (content: string, image?: ChatImageAttachment) => void;
  isStreaming: boolean;
  isConnecting?: boolean;
  initialMessage?: string;
  initialImage?: UploadedImageKeys | null;
  agentStatus: string;
}

function MessageImage({
  projectId,
  msg,
  onOpen,
}: {
  projectId: string;
  msg: ChatMessage;
  onOpen: () => void;
}) {
  const thumbnailUrl = useChatImage(projectId, msg.thumbnailKey);

  if (!msg.thumbnailKey || !thumbnailUrl) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-2 block overflow-hidden rounded-lg border border-border/50"
      title="View image"
    >
      <img
        src={thumbnailUrl}
        alt="Attached image"
        className="max-h-48 max-w-full object-cover"
        loading="lazy"
      />
    </button>
  );
}

export function ChatPanel({
  projectId,
  messages,
  onSendMessage,
  isStreaming,
  isConnecting = false,
  initialMessage,
  initialImage,
  agentStatus,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isPrettifying, setIsPrettifying] = useState(false);
  const [attachment, setAttachment] = useState<ChatImageAttachment | null>(
    initialImage ?? null,
  );
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [viewingMessage, setViewingMessage] = useState<ChatMessage | null>(
    null,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialAppliedRef = useRef(false);
  const initialImageAppliedRef = useRef(false);

  const isKeysAttachment = (
    a: ChatImageAttachment | null,
  ): a is UploadedImageKeys => Boolean(a && "imageKey" in a);

  // For pre-uploaded images, load the thumbnail through the auth proxy
  const keysThumbUrl = useChatImage(
    projectId,
    isKeysAttachment(attachment) ? attachment.thumbnailKey : undefined,
  );
  const previewUrl = isKeysAttachment(attachment) ? keysThumbUrl : filePreview;

  // Pre-fill the composer once when the project hasn't started yet
  useEffect(() => {
    if (initialMessage && !initialAppliedRef.current) {
      initialAppliedRef.current = true;
      setInput(initialMessage);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(
          textareaRef.current.scrollHeight,
          200,
        )}px`;
      }
    }
  }, [initialMessage]);

  // Attach the pre-uploaded image once it becomes available
  useEffect(() => {
    if (initialImage && !initialImageAppliedRef.current) {
      initialImageAppliedRef.current = true;
      setAttachment(initialImage);
    }
  }, [initialImage]);

  // Auto-send the initial prompt/image once the first-chat project page loads
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (isConnecting || autoSentRef.current) return;
    if (!initialMessage && !initialImage) return;
    if (messages.length > 0) return;
    autoSentRef.current = true;
    onSendMessage(initialMessage ?? "", initialImage ?? undefined);
    setInput("");
    setAttachment(null);
  }, [
    isConnecting,
    initialMessage,
    initialImage,
    onSendMessage,
    messages.length,
  ]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const attachImage = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    setAttachment(file);
    setFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      attachImage(file);
    }

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          attachImage(file);
        }
        return;
      }
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setFilePreview(null);
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if ((!trimmed && !attachment) || isStreaming || isConnecting) return;
    onSendMessage(trimmed, attachment ?? undefined);
    setInput("");
    clearAttachment();
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handlePrettify = async () => {
    const trimmed = input.trim();
    if (!trimmed || isPrettifying || isStreaming || isConnecting) return;

    setIsPrettifying(true);
    try {
      const prettified = await prettifyPrompt(projectId, trimmed);
      if (prettified) {
        setInput(prettified);
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.min(
            textareaRef.current.scrollHeight,
            200,
          )}px`;
          textareaRef.current.focus();
        }
      }
    } catch (err) {
      console.error("Failed to prettify prompt:", err);
    } finally {
      setIsPrettifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Send a message to start building...</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {!msg.content ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking...
                </span>
              ) : msg.role === "user" ? (
                <div>
                  {msg.content && (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.thumbnailKey && (
                    <MessageImage
                      projectId={projectId}
                      msg={msg}
                      onOpen={() => setViewingMessage(msg)}
                    />
                  )}
                </div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1
                        className="mb-3 text-lg font-semibold tracking-tight"
                        {...props}
                      />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="mb-2 text-base font-semibold" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 className="mb-2 text-sm font-semibold" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p
                        className="mb-3 whitespace-pre-wrap last:mb-0"
                        {...props}
                      />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul
                        className="mb-3 list-disc space-y-1 pl-5 last:mb-0"
                        {...props}
                      />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol
                        className="mb-3 list-decimal space-y-1 pl-5 last:mb-0"
                        {...props}
                      />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="pl-1" {...props} />
                    ),
                    a: ({ node, ...props }) => (
                      <a
                        className="text-primary underline underline-offset-2"
                        target="_blank"
                        rel="noreferrer"
                        {...props}
                      />
                    ),
                    code: ({ node, className, children, ...props }) => {
                      const isBlock = Boolean(className);

                      if (isBlock) {
                        return (
                          <code
                            className="block overflow-x-auto rounded-md bg-background px-3 py-2 font-mono text-[13px]"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      return (
                        <code
                          className="rounded bg-background px-1.5 py-0.5 font-mono text-[13px]"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    pre: ({ node, ...props }) => (
                      <pre
                        className="mb-3 overflow-x-auto rounded-md bg-background p-0 last:mb-0"
                        {...props}
                      />
                    ),
                    blockquote: ({ node, ...props }) => (
                      <blockquote
                        className="mb-3 border-l-2 border-border pl-3 italic text-muted-foreground last:mb-0"
                        {...props}
                      />
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}

        {/* Agent status indicator */}
        {isStreaming && agentStatus !== "idle" && agentStatus !== "done" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            {agentStatus === "thinking" && "Thinking..."}
            {agentStatus === "writing" && "Writing code..."}
            {agentStatus === "fixing" && "Fixing errors..."}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        {attachment && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/50 border border-border p-2">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Selected"
                className="h-12 w-12 rounded object-cover"
              />
            )}
            <span className="flex-1 truncate text-xs text-muted-foreground">
              {isKeysAttachment(attachment)
                ? "Attached image"
                : attachment.name}
            </span>
            <button
              onClick={clearAttachment}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-muted/50 rounded-lg border border-border px-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
            title="Attach an image"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Describe what you want to build..."
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm min-h-[36px] max-h-[200px] py-1.5"
          />
          <button
            onClick={handlePrettify}
            disabled={
              !input.trim() || isStreaming || isConnecting || isPrettifying
            }
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:hover:text-muted-foreground disabled:hover:bg-transparent"
            title="Rewrite your prompt to be clearer and more detailed"
          >
            {isPrettifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Prettify
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              (!input.trim() && !attachment) || isStreaming || isConnecting
            }
            className="flex-shrink-0 p-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Full image dialog */}
      <Dialog
        open={Boolean(viewingMessage)}
        onOpenChange={(open) => {
          if (!open) setViewingMessage(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogTitle className="sr-only">Attached image</DialogTitle>
          <FullImage projectId={projectId} message={viewingMessage} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FullImage({
  projectId,
  message,
}: {
  projectId: string;
  message: ChatMessage | null;
}) {
  const fullUrl = useChatImage(projectId, message?.imageKey);

  if (!message?.imageKey || !fullUrl) return null;

  return (
    <img
      src={fullUrl}
      alt="Full size attachment"
      className="mx-auto max-h-[70vh] w-auto rounded-lg"
    />
  );
}
