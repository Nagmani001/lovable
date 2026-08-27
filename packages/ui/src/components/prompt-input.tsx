"use client";

import * as React from "react";
import { Plus, ArrowUp, Mic, X, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  onAttachImage?: (file: File) => void;
  attachedImagePreview?: string | null;
  onRemoveImage?: () => void;
  onPrettify?: () => void;
  isPrettifying?: boolean;
}

function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask to create an interface...",
  className,
  onAttachImage,
  attachedImagePreview,
  onRemoveImage,
  onPrettify,
  isPrettifying = false,
}: PromptInputProps) {
  const hasText = value.trim().length > 0;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const MAX_INPUT_HEIGHT = 280;

  const resizeTextarea = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, []);

  React.useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onAttachImage?.(file);
    }
    e.target.value = "";
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    resizeTextarea();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          onAttachImage?.(file);
        }
        return;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && (hasText || attachedImagePreview)) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div
      className={cn(
        "w-full rounded-2xl bg-card border border-border overflow-hidden",
        className,
      )}
    >
      {attachedImagePreview && (
        <div className="flex items-center gap-2 px-4 pt-3">
          <div className="flex items-center gap-2 rounded-lg bg-secondary/40 border border-border p-1.5">
            <img
              src={attachedImagePreview}
              alt="Attached"
              className="h-10 w-10 rounded object-cover"
            />
            <button
              type="button"
              onClick={onRemoveImage}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Remove image"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        className="w-full bg-transparent text-foreground text-sm px-5 pt-4 pb-2 resize-none focus:outline-none placeholder:text-muted-foreground min-h-[56px] max-h-[280px] overflow-y-auto"
        rows={2}
      />
      <div className="flex items-center justify-between px-4 pb-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Attach an image"
        >
          <Plus size={16} />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrettify}
            disabled={!hasText || isPrettifying}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              hasText && !isPrettifying
                ? "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                : "text-muted-foreground opacity-40 cursor-not-allowed",
            )}
            title="Rewrite your prompt to be clearer and more detailed"
          >
            {isPrettifying ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Prettify
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            disabled={!hasText && !attachedImagePreview}
            onClick={onSubmit}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
              hasText || attachedImagePreview
                ? "bg-foreground text-background hover:opacity-80 cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-40",
            )}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export { PromptInput };
export type { PromptInputProps };
