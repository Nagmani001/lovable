"use client";

import { AmbientBackground } from "@/components/ambient-background";
import { PromptSection } from "@/components/prompt-section";
import { ProjectsBrowser } from "@/components/projects-browser";

export default function ProjectsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col relative overflow-hidden">
      <AmbientBackground />
      <div className="noise-overlay" />
      <PromptSection />
      <ProjectsBrowser />
    </div>
  );
}
