"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { PromptInput } from "@repo/ui/components/prompt-input";
import { createProject } from "@/lib/api";

const MODEL_OPTIONS = [
  { value: "claude", label: "Claude Sonnet" },
  { value: "openai", label: "GPT-4o" },
  { value: "gemini", label: "Gemini Flash" },
] as const;

export function PromptSection() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>("claude");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isCreating) return;

    try {
      setIsCreating(true);
      const result = await createProject(trimmed, model);
      router.push(`/project/${result.projectId}/${result.prompt}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      setIsCreating(false);
    }
  };

  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-8">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-3xl md:text-5xl font-semibold text-foreground mb-10 text-center tracking-tight"
      >
        What&apos;s on your mind?
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="w-full max-w-2xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <label
            htmlFor="model-select"
            className="text-sm text-muted-foreground"
          >
            Model:
          </label>
          <select
            id="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-sm bg-background border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <PromptInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          placeholder="Ask PromptForge to create an interface..."
        />

        {isCreating && (
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating your project...
          </div>
        )}
      </motion.div>
    </div>
  );
}
