"use client";

import * as React from "react";
import { cn } from "@repo/ui/lib/utils";

interface ProjectCardProps {
  name: string;
  date: string;
  emoji: string;
  onClick?: () => void;
  className?: string;
}

function ProjectCard({
  name,
  date,
  emoji,
  onClick,
  className,
}: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border bg-card p-4 cursor-pointer group hover:border-primary/30 transition-colors",
        className,
      )}
    >
      <div className="w-full h-28 rounded-lg bg-secondary mb-3 flex items-center justify-center text-3xl">
        {emoji}
      </div>
      <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
        {name}
      </h3>
      <p className="text-xs text-muted-foreground mt-1">{date}</p>
    </div>
  );
}

export { ProjectCard };
export type { ProjectCardProps };
