"use client";

import * as React from "react";
import { Plus, ArrowUp, Mic } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
}

function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask to create an interface...",
  className,
}: PromptInputProps) {
  const hasText = value.trim().length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && hasText) {
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
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-transparent text-foreground text-sm px-5 pt-4 pb-2 resize-none focus:outline-none placeholder:text-muted-foreground min-h-[56px]"
        rows={2}
      />
      <div className="flex items-center justify-between px-4 pb-3">
        <button
          type="button"
          className="w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Plus size={16} />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          >
            Plan
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            disabled={!hasText}
            onClick={onSubmit}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
              hasText
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
