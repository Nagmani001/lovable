"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const tooltips: Record<string, { title: string; description: string }> = {
  plus: {
    title: "Unlock more features",
    description:
      "Attach files and images, apply themes, connect integrations, and more by signing in.",
  },
  plan: {
    title: "Enable plan mode",
    description:
      "Plan your project structure before building. Organize ideas and set milestones.",
  },
  voice: {
    title: "Enable voice mode",
    description:
      "Describe what you want to build using your voice. Fast and hands-free.",
  },
  send: {
    title: "Send your prompt",
    description: "Submit your idea and watch it come to life in seconds.",
  },
};

export function CTASection() {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const hasText = inputValue.trim().length > 0;

  return (
    <section className="relative py-40 px-4 pb-56">
      <div className="relative z-10 max-w-2xl mx-auto text-center">
        <p className="text-sm text-muted-foreground mb-3 font-medium">
          No-code app builder
        </p>
        <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-10 tracking-tighter">
          Ready to build?
        </h2>

        {/* Prompt input box */}
        <div className="relative">
          <div className="rounded-2xl bg-card border border-border p-5 text-left">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Lovable to create a blog about..."
              rows={2}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none mb-6 min-h-[40px]"
            />

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between relative">
              {/* Left - Plus button */}
              <div className="relative">
                <button
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  onMouseEnter={() => setHoveredButton("plus")}
                  onMouseLeave={() => setHoveredButton(null)}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 3v10M3 8h10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              {/* Right - Plan, Voice, Send */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    className="px-3 h-8 rounded-full bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onMouseEnter={() => setHoveredButton("plan")}
                    onMouseLeave={() => setHoveredButton(null)}
                  >
                    Plan
                  </button>
                </div>

                <div className="relative">
                  <button
                    className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    onMouseEnter={() => setHoveredButton("voice")}
                    onMouseLeave={() => setHoveredButton(null)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  </button>
                </div>

                <div className="relative">
                  <button
                    disabled={!hasText}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      hasText
                        ? "bg-foreground text-background hover:bg-foreground/80 cursor-pointer"
                        : "bg-muted text-muted-foreground cursor-not-allowed opacity-40"
                    }`}
                    onMouseEnter={() => setHoveredButton("send")}
                    onMouseLeave={() => setHoveredButton(null)}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M7 12V2M7 2L3 6M7 2l4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tooltip popup */}
          <AnimatePresence>
            {hoveredButton && tooltips[hoveredButton] && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="absolute mt-3 max-w-xs"
                style={{
                  left: hoveredButton === "plus" ? "0" : "auto",
                  right: hoveredButton !== "plus" ? "0" : "auto",
                }}
              >
                <div className="rounded-2xl bg-card border border-border p-5 text-left">
                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    {tooltips[hoveredButton]!.title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {tooltips[hoveredButton]!.description}
                  </p>
                  <div className="flex justify-end">
                    <Link
                      href="/signin"
                      className="px-5 py-2 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
                    >
                      Sign in
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
