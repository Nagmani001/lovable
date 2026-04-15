"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { LovableLogo } from "@repo/ui/components/lovable-logo";

interface WorkspaceProcessingScreenProps {
  prompt: string;
  agentStatus: string;
}

export function WorkspaceProcessingScreen({
  prompt,
  agentStatus,
}: WorkspaceProcessingScreenProps) {
  const title =
    agentStatus === "writing"
      ? "Building your first version"
      : agentStatus === "fixing"
        ? "Fixing TypeScript errors"
        : "Thinking through your prompt";
  const description =
    agentStatus === "writing"
      ? "Writing the initial components and preparing the first preview."
      : agentStatus === "fixing"
        ? "Running the TypeScript compiler and fixing any errors found."
        : "Planning the structure before showing the preview.";

  return (
    <div className="flex h-full items-center justify-center bg-muted/20 p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-sm"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-muted/40">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6a5f]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbe2f]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,rgba(252,56,81,0.10),rgba(75,115,255,0.10))] p-8">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="flex flex-col items-center gap-4"
            >
              <LovableLogo size={64} />
              <div className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {agentStatus === "writing"
                  ? "Writing code"
                  : agentStatus === "fixing"
                    ? "Fixing errors"
                    : "Planning"}
              </div>
            </motion.div>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground/80">
            {prompt}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
